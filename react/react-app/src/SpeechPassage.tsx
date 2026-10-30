import { useEffect, useEffectEvent, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import ListPicker from "./ListPicker.tsx";
import { segmentInlineText } from "./speechText.ts";
import { followSpeechHighlight } from "./speechFollow.ts";

// Speech synthesis is shared by the whole browser tab. Only the current owner
// may cancel it, so deleting an idle widget cannot stop a different reader.
let stopActiveReader: (() => void) | null = null;
let playbackGeneration = 0;

export type PlayerState = { open: boolean; playing: boolean; generation?: number };

type Props = { defaultFollow?: boolean; autoPlayGeneration?: number; onContinueChapter?: (isCurrent: () => boolean, generation: number) => Promise<boolean>; mergeInlineText?: boolean; textContainer?: HTMLElement | null; initialOpen?: boolean; onPlayerStateChange?: (state: PlayerState) => void; autoPlay?: boolean; onComplete?: (isCurrent: () => boolean) => Promise<boolean>; hideText?: boolean; onPlaybackStart?: () => void; onPlayerOpen?: () => void; html: string; id: string; language: string; passageKey?: string; passageIndex?: number; playerTriggerContainer?: HTMLElement | null; stopPlayerRef?: RefObject<(() => void) | null> };
type Sentence = { text: string; index: number };

// Wrap readable text in place so the experimental reader retains the source
// markup, including verse labels, headings, links, and poetry formatting.
function prepareIntegratedPassage(html: string, language: string, mergeInlineText: boolean): { markup: string; paragraphs: Sentence[][] } {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const excluded = [
        "script", "style", "noscript", "sup", "[hidden]", "[aria-hidden='true']",
        ".yv-vlbl", ".yv-clbl", ".verse-number", ".verse-num", ".chapter-number", ".label",
        ".note", ".footnote", ".footnotes", ".crossreference", ".cross-reference",
        ".yv-note", ".yv-footnote", "[role='doc-noteref']", "[role='doc-footnote']",
        "[role='doc-endnotes']", "a[href^='#footnote']", "a[href^='#fn']",
    ].join(", ");
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (!node.parentElement?.closest(excluded) && (mergeInlineText || /[\p{L}\p{N}]/u.test(node.data))) nodes.push(node);
    }
    let segmenter: Intl.Segmenter | null = null;
    if (typeof Intl.Segmenter !== "undefined") {
        try { segmenter = new Intl.Segmenter(language || "en", { granularity: "sentence" }); }
        catch { segmenter = new Intl.Segmenter("en", { granularity: "sentence" }); }
    }
    const sentences: Sentence[] = [];
    if (mergeInlineText) {
        // PDF font changes create multiple text nodes inside one sentence.
        // Segment their combined text first, then map each sentence back onto
        // the original nodes so formatting and word highlighting both survive.
        const mapped = segmentInlineText(nodes.map(node => node.data), language);
        sentences.push(...mapped.sentences);
        nodes.forEach((node, index) => {
            const fragment = doc.createDocumentFragment();
            mapped.fragments[index].forEach(part => {
                if (part.index === undefined) {
                    fragment.append(doc.createTextNode(part.text));
                } else {
                    const span = doc.createElement("span");
                    span.dataset.speechIndex = String(part.index);
                    span.dataset.speechOffset = String(part.offset ?? 0);
                    span.textContent = part.text;
                    fragment.append(span);
                }
            });
            node.replaceWith(fragment);
        });
        return { markup: doc.body.innerHTML, paragraphs: [sentences] };
    }
    nodes.forEach(node => {
        const segments = segmenter ? Array.from(segmenter.segment(node.data), item => item.segment)
            : node.data.match(/[^.!?。！？]+[.!?。！？]*\s*/gu) ?? [node.data];
        const fragment = doc.createDocumentFragment();
        segments.forEach(text => {
            if (!/[\p{L}\p{N}]/u.test(text)) {
                fragment.append(doc.createTextNode(text));
                return;
            }
            const span = doc.createElement("span");
            span.dataset.speechIndex = String(sentences.length);
            span.textContent = text;
            fragment.append(span);
            sentences.push({ text, index: sentences.length });
        });
        node.replaceWith(fragment);
    });
    return { markup: doc.body.innerHTML, paragraphs: [sentences] };
}

function readPreference(key: string, fallback: string) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function voiceKey(voice: SpeechSynthesisVoice) {
    return `${voice.voiceURI}|${voice.name}|${voice.lang}`;
}

function readPosition(id: string, passageKey: string): number {
    try {
        const saved = JSON.parse(localStorage.getItem(id + "_speechPosition") ?? "null");
        return saved?.passageKey === passageKey && Number.isSafeInteger(saved.position) && saved.position >= 0
            ? saved.position : 0;
    } catch { return 0; }
}

export default function SpeechPassage({ defaultFollow = false, autoPlayGeneration, onContinueChapter, mergeInlineText = false, textContainer, initialOpen = false, onPlayerStateChange, autoPlay = false, onComplete, hideText = false, onPlaybackStart, onPlayerOpen, html, id, language, passageKey = "", passageIndex, playerTriggerContainer, stopPlayerRef }: Props) {
    const supported = typeof window.speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
    const [follow, setFollow] = useState(() => readPreference(id + "_speechFollow", String(defaultFollow)) === "true");
    const [continueChapter, setContinueChapter] = useState(() => readPreference(id + "_speechContinue", "false") === "true");
    const continueChapterRef = useRef(continueChapter);
    const textRef = useRef<HTMLDivElement>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => supported ? window.speechSynthesis.getVoices() : []);
    const [selectedVoice, setSelectedVoice] = useState(() => readPreference(id + "_voice", ""));
    const [rate, setRate] = useState(() => {
        const saved = Number(readPreference(id + "_speechRate", "1"));
        return Number.isFinite(saved) ? Math.max(0.5, Math.min(2, saved)) : 1;
    });
    const [playerGeneration, setPlayerGeneration] = useState(0);
    const [status, setStatus] = useState<"idle" | "playing" | "paused" | "ended">("idle");
    const [initialPosition] = useState(() => readPosition(id, passageKey));
    const [sentenceIndex, setSentenceIndex] = useState(initialPosition);
    const [word, setWord] = useState<{ start: number; end: number } | null>(null);
    const [error, setError] = useState("");
    const [playerOpen, setPlayerOpen] = useState(initialOpen || autoPlay);
    const settingsRef = useRef<HTMLDialogElement>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const wordStartRef = useRef<number | null>(null);
    const speechSessionRef = useRef(0);
    const watchdogRef = useRef<number | null>(null);
    const nextSpeechRef = useRef<number | null>(null);
    const rateChangeRef = useRef<number | null>(null);
    const stopRef = useRef<(() => void) | null>(null);
    const positionRef = useRef(initialPosition);
    const autoPlayConsumed = useRef(false);
    const mountGeneration = useRef(playbackGeneration);

    useEffect(() => {
        onPlayerStateChange?.({ open: playerOpen, playing: status === "playing", generation: status === "playing" ? playerGeneration : undefined });
    }, [playerOpen, status, playerGeneration, onPlayerStateChange]);

    const stopPlayback = useEffectEvent(() => pause());
    useEffect(() => {
        if (!stopPlayerRef) return;
        // Stop only this reader; speech synthesis is shared across the tab.
        const stop = () => {
            stopPlayback();
        };
        stopPlayerRef.current = stop;
        return () => {
            if (stopPlayerRef.current === stop) stopPlayerRef.current = null;
        };
    }, [stopPlayerRef]);

    const integratedPassage = useMemo(() => prepareIntegratedPassage(html, language, mergeInlineText), [html, language, mergeInlineText]);
    const sentences = useMemo(() => integratedPassage.paragraphs.flat(), [integratedPassage]);
    const currentPosition = Math.min(sentenceIndex, Math.max(0, sentences.length - 1));
    const highlightedMarkup = useMemo(() => {
        if (status !== "playing" && status !== "paused") return integratedPassage.markup;
        const doc = new DOMParser().parseFromString(integratedPassage.markup, "text/html");
        const active = doc.querySelectorAll<HTMLElement>(`[data-speech-index="${currentPosition}"]`);
        active.forEach(span => {
            span.classList.add("speech-sentence-active");
            if (word) {
                const text = span.textContent ?? "";
                const offset = Number(span.dataset.speechOffset ?? 0);
                const start = Math.max(0, word.start - offset);
                const end = Math.min(text.length, word.end - offset);
                if (end > start) {
                    const mark = doc.createElement("mark");
                    mark.textContent = text.slice(start, end);
                    span.replaceChildren(doc.createTextNode(text.slice(0, start)), mark, doc.createTextNode(text.slice(end)));
                }
            }
        });
        return doc.body.innerHTML;
    }, [integratedPassage, status, currentPosition, word]);
    useEffect(() => {
        if (!follow || status !== "playing" || document.hidden || !textRef.current) return;
        followSpeechHighlight(textRef.current);
    }, [follow, status, currentPosition, word, highlightedMarkup, textContainer]);

    const voice = selectedVoice ? voices.find(item => voiceKey(item) === selectedVoice)
        : voices.find(item => item.lang.toLowerCase() === language.toLowerCase())
        ?? voices.find(item => item.lang.split("-")[0] === language.split("-")[0])
        ?? voices.find(item => item.default) ?? voices[0];

    useEffect(() => {
        if (!supported) return;
        const synth = window.speechSynthesis;
        const sessionCounter = speechSessionRef;
        const update = () => setVoices(synth.getVoices());
        update();
        synth.addEventListener("voiceschanged", update);
        return () => {
            synth.removeEventListener("voiceschanged", update);
            // Invalidate callbacks before cancel(), which may emit an error event.
            sessionCounter.current++;
            if (watchdogRef.current !== null) window.clearInterval(watchdogRef.current);
            if (nextSpeechRef.current !== null) window.clearTimeout(nextSpeechRef.current);
            if (rateChangeRef.current !== null) window.clearTimeout(rateChangeRef.current);
            utteranceRef.current = null;
            if (stopRef.current && stopActiveReader === stopRef.current) {
                stopActiveReader = null;
                synth.cancel();
            }
        };
    }, [supported]);

    function savePreference(key: string, value: string) {
        try { localStorage.setItem(id + key, value); }
        catch { setError("Your voice settings could not be saved on this device."); }
    }

    function savePosition(position: number) {
        try {
            // Ignore late speech callbacks from a chapter that was just changed.
            if (passageIndex !== undefined && Number(localStorage.getItem(id + "_index") ?? "0") !== passageIndex) return;
            localStorage.setItem(id + "_speechPosition", JSON.stringify({ passageKey, position }));
        }
        catch { setError("Your reading position could not be saved on this device."); }
    }

    function pause() {
        autoPlayConsumed.current = true;
        speechSessionRef.current++;
        if (watchdogRef.current !== null) window.clearInterval(watchdogRef.current);
        if (nextSpeechRef.current !== null) window.clearTimeout(nextSpeechRef.current);
        if (rateChangeRef.current !== null) window.clearTimeout(rateChangeRef.current);
        watchdogRef.current = null;
        nextSpeechRef.current = null;
        rateChangeRef.current = null;
        utteranceRef.current = null;
        if (stopRef.current && stopActiveReader === stopRef.current) {
            stopActiveReader = null;
            window.speechSynthesis.cancel();
        }
        setWord(null);
        wordStartRef.current = null;
        setStatus("paused");
    }

    function play(start: number, playbackRate = rate, startOffset = 0, playbackVoice: SpeechSynthesisVoice | null = voice ?? null) {
        autoPlayConsumed.current = true;
        if (!supported || !sentences.length) return;
        if (!playbackVoice) {
            setError("Your selected voice is not available yet. Wait for it to load or choose another voice in settings.");
            return;
        }
        // Pin even an automatically chosen voice across chapter/page remounts.
        const key = voiceKey(playbackVoice);
        setSelectedVoice(key);
        savePreference("_voice", key);
        const generation = ++playbackGeneration;
        setPlayerGeneration(generation);
        onPlaybackStart?.();
        start = Math.min(Math.max(0, start), sentences.length - 1);
        const synth = window.speechSynthesis;
        const previousReader = stopActiveReader;
        previousReader?.();
        if (!previousReader) synth.cancel();
        if (synth.paused) synth.resume();
        const session = ++speechSessionRef.current;
        stopRef.current = pause;
        stopActiveReader = pause;
        setError("");
        setPlayerOpen(true);
        setStatus("playing");
        function clearWatchdog() {
            if (watchdogRef.current !== null) window.clearInterval(watchdogRef.current);
            watchdogRef.current = null;
        }
        function speak(index: number, requestedOffset = 0, retries = 0) {
            if (speechSessionRef.current !== session) return;
            clearWatchdog();
            if (index >= sentences.length) {
                utteranceRef.current = null;
                const finish = () => {
                    if (speechSessionRef.current !== session) return;
                    stopActiveReader = null;
                    positionRef.current = 0;
                    setSentenceIndex(0);
                    savePosition(0);
                    setWord(null);
                    setStatus("ended");
                };
                const continueReading = onComplete ?? (continueChapterRef.current ? onContinueChapter : undefined);
                if (continueReading) {
                    // Retain ownership while the next page or chapter is selected.
                    // Pause, closing the player, or another reader invalidates this session.
                    void continueReading(() => speechSessionRef.current === session, generation).then(continued => {
                        if (!continued) finish();
                    }).catch(() => {
                        if (speechSessionRef.current !== session) return;
                        pause();
                        setError("Could not continue reading. Press Play to retry.");
                    });
                } else finish();
                return;
            }
            positionRef.current = index;
            setSentenceIndex(index);
            savePosition(index);
            setWord(null);
            const offset = Math.min(requestedOffset, sentences[index].text.length);
            wordStartRef.current = offset || null;
            const utterance = new SpeechSynthesisUtterance(sentences[index].text.slice(offset));
            utterance.voice = playbackVoice;
            utterance.lang = playbackVoice?.lang || language || "en";
            utterance.rate = playbackRate;
            utteranceRef.current = utterance;
            let lastProgress = Date.now();
            let hasWordEvents = false;
            function retry() {
                if (utteranceRef.current !== utterance || speechSessionRef.current !== session) return;
                const retryOffset = wordStartRef.current ?? offset;
                clearWatchdog();
                utteranceRef.current = null;
                synth.cancel();
                if (retries >= 2) {
                    pause();
                    setError("Reading stopped unexpectedly. Press Play to retry or choose another voice.");
                    return;
                }
                nextSpeechRef.current = window.setTimeout(() => {
                    nextSpeechRef.current = null;
                    if (speechSessionRef.current === session) speak(index, retryOffset, retries + 1);
                }, 250);
            }
            utterance.onstart = () => { lastProgress = Date.now(); };
            utterance.onboundary = event => {
                if (utteranceRef.current !== utterance || event.name !== "word") return;
                lastProgress = Date.now();
                hasWordEvents = true;
                const start = event.charIndex + offset;
                const match = utterance.text.slice(event.charIndex).match(/^\S+/u);
                if (match) {
                    wordStartRef.current = start;
                    setWord({ start, end: start + match[0].length });
                }
            };
            utterance.onend = () => {
                if (utteranceRef.current !== utterance || speechSessionRef.current !== session) return;
                clearWatchdog();
                utteranceRef.current = null;
                // Let the browser finish processing this utterance before queuing the next one.
                nextSpeechRef.current = window.setTimeout(() => {
                    nextSpeechRef.current = null;
                    if (speechSessionRef.current === session) speak(index + 1);
                }, 0);
            };
            utterance.onerror = event => {
                if (utteranceRef.current !== utterance || speechSessionRef.current !== session) return;
                pause();
                setError(`Speech could not continue (${event.error}). Try another voice or press Play again.`);
            };
            try {
                synth.speak(utterance);
                watchdogRef.current = window.setInterval(() => {
                    if (utteranceRef.current !== utterance || speechSessionRef.current !== session || document.visibilityState !== "visible") return;
                    const elapsed = Date.now() - lastProgress;
                    // Some voices don't emit word boundaries, so only use the
                    // longer progress timeout when this voice has emitted one.
                    if ((!synth.speaking && !synth.pending && elapsed > 8000) || (hasWordEvents && elapsed > 60000)) retry();
                }, 2000);
            }
            catch { pause(); setError("Could not start speech. Try another voice."); }
        }
        // Let the speech engine settle after cancel before starting another utterance.
        nextSpeechRef.current = window.setTimeout(() => {
            nextSpeechRef.current = null;
            if (speechSessionRef.current === session) speak(start, startOffset);
        }, 100);
    }

    const startAutomatically = useEffectEvent(() => {
        if (autoPlayConsumed.current) return;
        if ((autoPlayGeneration ?? mountGeneration.current) !== playbackGeneration) {
            autoPlayConsumed.current = true;
            return;
        }
        play(0);
    });
    useEffect(() => {
        if (!autoPlay || !voice) return;
        // Voice discovery can be asynchronous. Never start with a fallback voice,
        // and never let a pending automatic start restart manually paused speech.
        const timer = window.setTimeout(() => startAutomatically(), 0);
        return () => window.clearTimeout(timer);
    }, [autoPlay, voice]);

    function changeFollow(value: boolean) {
        setFollow(value);
        savePreference("_speechFollow", String(value));
    }

    function changeRate(value: number) {
        // Browser speech rates cannot be changed on an utterance already in
        // progress. Restart at the last reported word, or at the segment if
        // the selected voice does not report word boundaries.
        setRate(value);
        savePreference("_speechRate", String(value));
        if (rateChangeRef.current !== null) window.clearTimeout(rateChangeRef.current);
        if (status === "playing") {
            // Continue at the old speed while the slider moves, then restart once.
            rateChangeRef.current = window.setTimeout(() => {
                rateChangeRef.current = null;
                if (stopRef.current && stopActiveReader === stopRef.current) {
                    play(positionRef.current, value, wordStartRef.current ?? 0);
                }
            }, 300);
        }
    }

    function changeVoice(nextVoice: SpeechSynthesisVoice) {
        const key = voiceKey(nextVoice);
        if (voice && voiceKey(voice) === key) return;
        const offset = wordStartRef.current ?? 0;
        setSelectedVoice(key);
        savePreference("_voice", key);
        // A voice can't be changed on an utterance already being spoken.
        if (status === "playing") play(positionRef.current, rate, offset, nextVoice);
    }

    return <div className="speech-passage">
        <div className={`speech-disclosure${playerOpen || error ? " speech-disclosure-open" : ""}`}>
            {playerTriggerContainer && createPortal(<button type="button" className="speech-icon-button speech-player-toggle" aria-label={playerOpen ? "Close read aloud player" : "Open read aloud player"}
                title={playerOpen ? "Close read aloud player" : "Open read aloud player"}
                aria-expanded={playerOpen} aria-controls={playerOpen ? `${id}-read-aloud-player` : undefined} onClick={() => {
                    if (playerOpen) pause();
                    if (!playerOpen) onPlayerOpen?.();
                    setPlayerOpen(!playerOpen);
                }}>
                <span className="material-icons" aria-hidden="true">{playerOpen ? "close" : "volume_up"}</span>
            </button>, playerTriggerContainer)}
            {playerOpen && <div id={`${id}-read-aloud-player`} className="speech-mini-player" role="group" aria-label="Read aloud player">
                {!supported ? <p role="status">Text to speech is not available in this browser.</p> : <>
                    <button type="button" className={`speech-icon-button${status === "playing" ? " speech-playing" : ""}`} disabled={!sentences.length}
                        aria-label={status === "playing" ? "Stop reading" : "Play reading"}
                        title={status === "playing" ? "Stop reading" : "Play reading"}
                        onClick={() => status === "playing" ? pause() : play(positionRef.current)}>
                        <span className="material-icons" aria-hidden="true">{status === "playing" ? "pause" : "play_arrow"}</span>
                    </button>
                    <label className="speech-mini-position">
                        <span aria-hidden="true">{sentences.length ? currentPosition + 1 : 0} / {sentences.length}</span>
                        <input type="range" min="0" max={Math.max(0, sentences.length - 1)} step="1"
                            value={currentPosition} disabled={!sentences.length}
                            aria-label="Reading position"
                            aria-valuetext={sentences.length ? `Position ${currentPosition + 1} of ${sentences.length}` : "No readable text"}
                            onChange={event => {
                                const nextIndex = Number(event.target.value);
                                positionRef.current = nextIndex;
                                setSentenceIndex(nextIndex);
                                savePosition(nextIndex);
                                setWord(null);
                                if (status === "playing") play(nextIndex);
                                else setStatus("paused");
                            }} />
                    </label>
                    <button type="button" className={`speech-icon-button${follow ? " speech-follow-active" : ""}`}
                        aria-label="Follow highlighted text" aria-pressed={follow} title={`Follow highlighted text: ${follow ? "on" : "off"}`}
                        onClick={() => changeFollow(!follow)}>
                        <span className="material-icons" aria-hidden="true">my_location</span>
                    </button>
                    <button type="button" className="speech-icon-button" aria-label="Read aloud settings"
                        aria-haspopup="dialog" onClick={() => settingsRef.current?.showModal()}>
                        <span className="material-icons" aria-hidden="true">settings</span>
                    </button>
                </>}
                {hideText && !sentences.length && <p role="status">No readable text on this page. Scanned pages may contain only images.</p>}
                {error && <p className="passage-error" role="alert">{error}</p>}
            </div>}
            {!playerOpen && error && <p className="passage-error" role="alert">{error}</p>}
            {createPortal(<dialog ref={settingsRef} className="passage-picker speech-settings" aria-labelledby={`${id}-speech-settings-title`}
                onClick={event => {
                    if (event.target !== event.currentTarget) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) settingsRef.current?.close();
                }}>
                <div className="passage-picker-heading">
                    <h2 id={`${id}-speech-settings-title`}>Read aloud settings</h2>
                    <button type="button" className="passage-picker-close" aria-label="Close read aloud settings" onClick={() => settingsRef.current?.close()}>×</button>
                </div>
                <div className="passage-picker-panel speech-settings-content">
                    <span>Voice</span>
                    <ListPicker title="Select voice" className="version-select" options={voices.map((item, index) => ({
                        value: index, label: `${item.name} — ${item.lang}${item.localService ? " · Local" : " · Online"}`,
                    }))} value={voice ? voices.indexOf(voice) : null} disabled={!voices.length}
                        onChange={index => {
                            const nextVoice = voices[index];
                            if (nextVoice) changeVoice(nextVoice);
                        }} />
                    {!voice && <p className="speech-caption">{selectedVoice ? "Waiting for your selected voice. You can choose another voice above." : "Browser voices are loading."}</p>}
                    <label>Speed: {rate.toFixed(1)}×
                        <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={event => {
                            changeRate(Number(event.target.value));
                        }} />
                    </label>
                    <label className="speech-settings-toggle">
                        <input type="checkbox" checked={follow} onChange={event => changeFollow(event.target.checked)} />
                        Follow highlighted text
                    </label>
                    {onContinueChapter && <label className="speech-settings-toggle">
                        <input type="checkbox" checked={continueChapter} onChange={event => {
                            continueChapterRef.current = event.target.checked;
                            setContinueChapter(event.target.checked);
                            savePreference("_speechContinue", String(event.target.checked));
                        }} />
                        Continue to the next chapter
                    </label>}
                    <p className="speech-caption">Online voices may send text to a speech service.</p>
                </div>
            </dialog>, document.body)}
        </div>
        {textContainer
            ? createPortal(<div ref={textRef} className="speech-integrated-text" dangerouslySetInnerHTML={{ __html: highlightedMarkup }} />, textContainer)
            : !hideText && <div ref={textRef} className="speech-integrated-text" dangerouslySetInnerHTML={{ __html: highlightedMarkup }} />}
    </div>;
}

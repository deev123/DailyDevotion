import { useEffect, useMemo, useRef, useState } from "react";

// Speech synthesis is shared by the whole browser tab. Only the current owner
// may cancel it, so deleting an idle widget cannot stop a different reader.
let stopActiveReader: (() => void) | null = null;

type Props = { html: string; id: string; language: string };

function readPreference(key: string, fallback: string) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function voiceKey(voice: SpeechSynthesisVoice) {
    return `${voice.voiceURI}|${voice.name}|${voice.lang}`;
}

export default function SpeechPassage({ html, id, language }: Props) {
    const supported = typeof window.speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState(() => readPreference(id + "_voice", ""));
    const [rate, setRate] = useState(() => {
        const saved = Number(readPreference(id + "_speechRate", "1"));
        return Number.isFinite(saved) ? Math.max(0.5, Math.min(2, saved)) : 1;
    });
    const [status, setStatus] = useState<"idle" | "playing" | "paused" | "ended">("idle");
    const [sentenceIndex, setSentenceIndex] = useState(0);
    const [word, setWord] = useState<{ start: number; end: number } | null>(null);
    const [error, setError] = useState("");
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const stopRef = useRef<(() => void) | null>(null);
    const positionRef = useRef(0);

    const paragraphs = useMemo(() => {
        const document = new DOMParser().parseFromString(html, "text/html");
        // YouVersion uses yv-vlbl spans, not just superscripts, for verse
        // numbers. Remove metadata by markup rather than stripping all digits:
        // numbers in the actual passage (ages, quantities, etc.) must survive.
        document.querySelectorAll([
            "script", "style", "noscript", "sup", "[hidden]", "[aria-hidden='true']",
            ".yv-vlbl", ".yv-clbl", ".verse-number", ".verse-num", ".chapter-number", ".label",
            ".note", ".footnote", ".footnotes", ".crossreference", ".cross-reference",
            ".yv-note", ".yv-footnote", "[role='doc-noteref']", "[role='doc-footnote']",
            "[role='doc-endnotes']", "a[href^='#footnote']", "a[href^='#fn']",
        ].join(", ")).forEach(node => node.replaceWith(" "));
        // Preserve boundaries even for provider markup using div.p and poetry
        // lines, otherwise adjacent verses can become a single spoken word.
        document.querySelectorAll("br, .yv-v").forEach(node => {
            if (node.tagName === "BR") node.replaceWith(" ");
            else node.prepend(" ");
        });
        document.querySelectorAll("p, div, h1, h2, h3, h4, li").forEach(node => {
            node.prepend("\n");
            node.append("\n");
        });
        const texts = (document.body.textContent ?? "").split(/\n+/u)
            .map(text => text
                .replace(/[\u00ad\u200b\ufeff]/gu, "") // soft hyphens and invisible layout characters
                .replace(/\s+/gu, " ")
                .replace(/\s+([,.;:!?])/gu, "$1")
                .trim())
            .filter(text => /[\p{L}\p{N}]/u.test(text));
        let index = 0;
        return texts.map(text => {
            let segments: string[];
            if (typeof Intl.Segmenter !== "undefined") {
                let segmenter: Intl.Segmenter;
                try { segmenter = new Intl.Segmenter(language || "en", { granularity: "sentence" }); }
                catch { segmenter = new Intl.Segmenter("en", { granularity: "sentence" }); }
                segments = Array.from(segmenter.segment(text), item => item.segment);
            } else {
                segments = text.match(/[^.!?。！？]+[.!?。！？]*\s*/gu) ?? [text];
            }
            return segments.map(text => ({ text, index: index++ }));
        });
    }, [html, language]);
    const sentences = useMemo(() => paragraphs.flat(), [paragraphs]);
    const voice = voices.find(item => voiceKey(item) === selectedVoice)
        ?? voices.find(item => item.lang.toLowerCase() === language.toLowerCase())
        ?? voices.find(item => item.lang.split("-")[0] === language.split("-")[0])
        ?? voices.find(item => item.default) ?? voices[0];

    useEffect(() => {
        if (!supported) return;
        const synth = window.speechSynthesis;
        const update = () => setVoices(synth.getVoices());
        update();
        synth.addEventListener("voiceschanged", update);
        return () => {
            synth.removeEventListener("voiceschanged", update);
            // Invalidate callbacks before cancel(), which may emit an error event.
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

    function pause() {
        utteranceRef.current = null;
        if (stopRef.current && stopActiveReader === stopRef.current) {
            stopActiveReader = null;
            window.speechSynthesis.cancel();
        }
        setWord(null);
        setStatus("paused");
    }

    function play(start: number) {
        if (!supported || !sentences.length) return;
        stopActiveReader?.();
        const synth = window.speechSynthesis;
        synth.cancel();
        stopRef.current = pause;
        stopActiveReader = pause;
        setError("");
        setStatus("playing");
        function speak(index: number) {
            if (index >= sentences.length) {
                utteranceRef.current = null;
                stopActiveReader = null;
                positionRef.current = 0;
                setWord(null);
                setStatus("ended");
                return;
            }
            positionRef.current = index;
            setSentenceIndex(index);
            setWord(null);
            const utterance = new SpeechSynthesisUtterance(sentences[index].text);
            utterance.voice = voice ?? null;
            utterance.lang = voice?.lang || language || "en";
            utterance.rate = rate;
            utteranceRef.current = utterance;
            utterance.onboundary = event => {
                if (utteranceRef.current !== utterance || event.name !== "word") return;
                const start = event.charIndex;
                const match = utterance.text.slice(start).match(/^\S+/u);
                if (match) setWord({ start, end: start + match[0].length });
            };
            utterance.onend = () => {
                if (utteranceRef.current === utterance) speak(index + 1);
            };
            utterance.onerror = event => {
                if (utteranceRef.current !== utterance) return;
                pause();
                setError(`Speech could not continue (${event.error}). Try another voice or press Play again.`);
            };
            try { synth.speak(utterance); }
            catch { pause(); setError("Could not start speech. Try another voice."); }
        }
        speak(start);
    }

    return <div className="speech-passage">
        <div className="speech-controls" role="group" aria-label="Read aloud controls">
            <p className="speech-caption">Read aloud demo</p>
            {!supported ? <p role="status">Text to speech is not available in this browser.</p> : <>
                <label>Voice
                    <select value={voice ? voiceKey(voice) : ""} onChange={event => {
                        pause(); setSelectedVoice(event.target.value); savePreference("_voice", event.target.value);
                    }}>
                        {!voices.length && <option value="">Browser default (voices loading)</option>}
                        {voices.map((item, index) => <option key={`${voiceKey(item)}-${index}`} value={voiceKey(item)}>
                            {item.name} — {item.lang}{item.localService ? " · Local" : " · Online"}
                        </option>)}
                    </select>
                </label>
                <label>Speed: {rate.toFixed(1)}×
                    <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={event => {
                        pause(); const value = Number(event.target.value); setRate(value); savePreference("_speechRate", String(value));
                    }} />
                </label>
                <div className="speech-buttons">
                    <button disabled={!sentences.length} onClick={() => status === "playing" ? pause() : play(positionRef.current)}>
                        {status === "playing" ? "Pause" : status === "paused" ? "Resume sentence" : status === "ended" ? "Read again" : "Play"}
                    </button>
                    <button disabled={!sentences.length} onClick={() => { pause(); positionRef.current = 0; setSentenceIndex(0); setStatus("idle"); }}>Stop / reset</button>
                </div>
                <p className="speech-caption" role="status">{status === "playing" ? `Reading sentence ${sentenceIndex + 1} of ${sentences.length}.` : status === "ended" ? "Finished reading." : status === "paused" ? "Paused. Resume repeats the current sentence." : "Choose a voice and press Play."}</p>
                <p className="speech-caption">The current sentence is highlighted; word highlighting appears when the voice supports it. Online voices may send text to a speech service.</p>
            </>}
            {error && <p className="passage-error" role="alert">{error}</p>}
        </div>
        <div className="speech-text">
            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph.map(sentence => {
                const active = (status === "playing" || status === "paused") && sentence.index === sentenceIndex;
                return <span key={sentence.index} className={active ? "speech-sentence-active" : undefined}>
                    {active && word ? <>{sentence.text.slice(0, word.start)}<mark>{sentence.text.slice(word.start, word.end)}</mark>{sentence.text.slice(word.end)}</> : sentence.text}{" "}
                </span>;
            })}</p>)}
            {!sentences.length && <p>No readable text is available for this passage.</p>}
        </div>
    </div>;
}

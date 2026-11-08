import { useEffect, useRef, useState } from "react";
import PassageContext from "./PassageContext";
import PassagePicker from "../../components/PassagePicker";
import Menu, { type MenuOption } from "../../components/Menu";
import YouVersionAPI from "../bible/YouVersionAPI";
import "./verseGame.css";

type Round = { reference: string; verse: number; text: string; index: number; bibleId: number };
type Hint = { verse: number; text: string };
const ROUND_SECONDS = 60;
const ROUNDS = 5;
const HINT_COST = 100;

function extractText(html: string): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll(".yv-vlbl, .yv-clbl, .verse-number, .verse-num, .chapter-number, .label, sup, script, style, [class*=footnote]").forEach(el => el.remove());
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export default function VerseGame({ layoutOptions }: { layoutOptions: MenuOption[] }) {
    const [chapters, setChapters] = useState<string[]>([]);
    const [round, setRound] = useState<Round | null>(null);
    const [roundNumber, setRoundNumber] = useState(0);
    const [score, setScore] = useState(0);
    const [guessIndex, setGuessIndex] = useState(-1);
    const [hints, setHints] = useState<Hint[]>([]);
    const [hintLoading, setHintLoading] = useState(false);
    const [hintError, setHintError] = useState("");
    const [afterUnavailable, setAfterUnavailable] = useState(false);
    const [readingContext, setReadingContext] = useState(false);
    const [remaining, setRemaining] = useState(ROUND_SECONDS);
    const [phase, setPhase] = useState<"intro" | "loading" | "playing" | "result" | "finished">("intro");
    const [result, setResult] = useState<{ distance: number | null; points: number; guess: string } | null>(null);
    const [error, setError] = useState("");
    const [version, setVersion] = useState("");
    const [copyright, setCopyright] = useState("");
    const [container, setContainer] = useState<HTMLElement | null>(null);
    const deadline = useRef(0);
    const requestId = useRef(0);
    useEffect(() => {
        let active = true;
        const requests = requestId;
        fetch(`${import.meta.env.BASE_URL}Bible_Chapters.txt`).then(response => {
            if (!response.ok) throw new Error("Failed to load chapters");
            return response.text();
        }).then(text => { if (active) setChapters(text.split(/\r?\n/).map(line => line.trim()).filter(line => YouVersionAPI.referenceToUsfm(line))); }).catch(() => { if (active) setError("Could not load the Bible chapter list."); });
        return () => { active = false; requests.current++; };
    }, []);
    async function nextRound(number: number) {
        const request = ++requestId.current;
        setPhase("loading"); setReadingContext(false); setError(""); setRound(null); setResult(null); setGuessIndex(-1); setHints([]); setHintLoading(false); setHintError(""); setAfterUnavailable(false);
        const versions = await YouVersionAPI.fetchVersions();
        const defaultId = Number(localStorage.getItem("defaultBibleVersion"));
        const chosen = versions.find(item => item.id === defaultId) ?? versions.find(item => item.languageTag.toLowerCase().startsWith("en")) ?? versions[0];
        if (!chosen) { if (request === requestId.current) { setError("Could not load Bible translations. Check your connection and try again."); setPhase("intro"); } return; }
        const detail = await YouVersionAPI.fetchVersionDetail(chosen.id);
        if (request !== requestId.current) return;
        setVersion(chosen.abbreviation || chosen.title); setCopyright(detail?.copyright ?? "");
        for (let attempt = 0; attempt < 12; attempt++) {
            const index = Math.floor(Math.random() * chapters.length);
            const reference = chapters[index];
            const verse = Math.floor(Math.random() * 30) + 1;
            const usfm = YouVersionAPI.referenceToUsfm(reference);
            if (!usfm) continue;
            const passage = await YouVersionAPI.fetchChapterHtml(chosen.id, `${usfm}.${verse}`);
            if (request !== requestId.current) return;
            const text = extractText(passage.html);
            if (!passage.ok || text.length < 12) continue;
            setRound({ reference, verse, text, index, bibleId: chosen.id }); setRoundNumber(number); setRemaining(ROUND_SECONDS);
            deadline.current = Date.now() + ROUND_SECONDS * 1000;
            setPhase("playing"); return;
        }
        if (request === requestId.current) { setError("Could not find a playable verse in this translation. Check your connection or choose another default translation in a Bible reader, then try again."); setPhase("intro"); }
    }
    async function revealHint(direction: -1 | 1) {
        if (!round || hintLoading || phase !== "playing") return;
        const numbers = [round.verse, ...hints.map(hint => hint.verse)];
        const verse = direction < 0 ? Math.min(...numbers) - 1 : Math.max(...numbers) + 1;
        if (verse < 1) return;
        const usfm = YouVersionAPI.referenceToUsfm(round.reference);
        if (!usfm) return;
        const request = requestId.current;
        setHintLoading(true); setHintError("");
        const passage = await YouVersionAPI.fetchChapterHtml(round.bibleId, `${usfm}.${verse}`);
        if (request !== requestId.current) return;
        setHintLoading(false);
        const text = extractText(passage.html);
        if (!passage.ok || !text) {
            if (passage.unavailable && direction > 0) setAfterUnavailable(true);
            setHintError(passage.unavailable ? "No more verses available in this direction." : "Could not load that hint. No points were deducted; please try again.");
            return;
        }
        setHints(current => [...current, { verse, text }]);
    }
    function submit(timedOut = false) {
        if (!round || phase !== "playing") return;
        requestId.current++;
        const guess = chapters[guessIndex] ?? "";
        const index = guessIndex;
        const distance = index < 0 ? null : Math.abs(index - round.index);
        const points = distance === null ? 0 : Math.max(0, 1000 - distance * 10 - hints.length * HINT_COST);
        setResult({ distance, points, guess: guess || (timedOut ? "Time ran out" : "No guess") });
        setScore(value => value + points); setPhase("result");
    }
    useEffect(() => {
        if (phase !== "playing") return;
        const tick = () => {
            const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
            setRemaining(seconds);
            if (seconds === 0) submit(true);
        };
        const timer = window.setInterval(tick, 250);
        document.addEventListener("visibilitychange", tick);
        return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
    });
    function start() { setScore(0); void nextRound(1); }
    return <section ref={setContainer} className="verse-game">
        <div className="verse-game-top"><div><span className="verse-game-eyebrow">EXPERIMENTAL</span><h2>Verse Finder Game</h2></div><div className="verse-game-top-actions">
            <button type="button" className="verse-game-icon" aria-label="Toggle fullscreen" title="Toggle fullscreen" onClick={() => { if (document.fullscreenElement === container) void document.exitFullscreen(); else if (container?.requestFullscreen) void container.requestFullscreen().catch(() => setError("Fullscreen is not available on this device.")); else setError("Fullscreen is not available on this device."); }}><span className="material-icons" aria-hidden="true">fullscreen</span></button>
            <Menu options={layoutOptions}><button type="button" className="verse-game-icon" aria-label="Section options"><span className="material-icons" aria-hidden="true">more_vert</span></button></Menu>
        </div></div>
        <div className="verse-game-body">
            {phase === "intro" && <div className="verse-game-intro"><div className="verse-game-compass" aria-hidden="true">?</div><h3>Where in the Bible?</h3><p>Explore five mystery verses. Place each one as close as you can by choosing its book and chapter.</p><p className="verse-game-hint">60 seconds per verse · 1,000 points for an exact chapter · 10 points lost per chapter away · hints cost 100 points each</p><button type="button" className="verse-game-primary" disabled={!chapters.length} onClick={start}>Start exploring <span aria-hidden="true">→</span></button></div>}
            {phase === "loading" && <p className="verse-game-loading" role="status">Finding a verse to explore…</p>}
            {(phase === "playing" || phase === "result") && round && <>
                <div className="verse-game-stats"><span>ROUND <strong>{roundNumber} / {ROUNDS}</strong></span><span>SCORE <strong>{score.toLocaleString()}</strong></span><span className={remaining <= 10 && phase === "playing" ? "verse-game-urgent" : ""}>TIME <strong>{phase === "playing" ? `0:${String(remaining).padStart(2, "0")}` : "—"}</strong></span></div>
                <div className="verse-game-quote"><span className="verse-game-quote-mark" aria-hidden="true">“</span>{hints.filter(hint => hint.verse < round.verse).sort((a, b) => a.verse - b.verse).map(hint => <p className="verse-game-hint-verse" key={hint.verse}>{hint.text}</p>)}<blockquote>{round.text}</blockquote>{hints.filter(hint => hint.verse > round.verse).sort((a, b) => a.verse - b.verse).map(hint => <p className="verse-game-hint-verse" key={hint.verse}>{hint.text}</p>)}<span className="verse-game-version">{version}</span></div>
                {phase === "playing" ? <div className="verse-game-guess"><div className="verse-game-hints"><span>Reveal a neighbouring verse · −{HINT_COST} points each</span><div><button type="button" disabled={hintLoading || Math.min(round.verse, ...hints.map(hint => hint.verse)) <= 1} onClick={() => void revealHint(-1)}>← Verse before</button><button type="button" disabled={hintLoading || afterUnavailable} onClick={() => void revealHint(1)}>Verse after →</button></div>{hintLoading && <p role="status">Loading hint…</p>}{hintError && <p role="status">{hintError}</p>}{hints.length > 0 && <p>{hints.length} hint{hints.length === 1 ? "" : "s"} used · −{hints.length * HINT_COST} points</p>}</div><div><h3>Place the passage</h3><p>Choose the book and chapter you think it comes from.</p></div><div className="verse-game-picker"><PassagePicker references={chapters} value={guessIndex} onChange={setGuessIndex} portalTarget={container} /></div><button type="button" className="verse-game-primary" disabled={guessIndex < 0} onClick={() => submit()}>Lock in guess →</button></div> : result && <div className="verse-game-result" role="status"><span className="verse-game-eyebrow">{result.distance === 0 ? "PERFECT PLACEMENT" : "THE VERSE WAS FROM"}</span><h3>{round.reference}:{round.verse}</h3><p>Your guess: {result.guess}{result.distance !== null && ` · ${result.distance} chapter${result.distance === 1 ? "" : "s"} away`}</p><strong>+{result.points.toLocaleString()} points</strong>{hints.length > 0 && <p>{hints.length} hint{hints.length === 1 ? "" : "s"} · −{hints.length * HINT_COST} points</p>}<button type="button" className="verse-context-open" onClick={() => setReadingContext(value => !value)}>{readingContext ? "Close passage context" : "Read passage context"}</button>{readingContext && <PassageContext chapters={chapters} index={round.index} verse={round.verse} bibleId={round.bibleId} version={version} onClose={() => setReadingContext(false)} />}<button type="button" className="verse-game-primary" onClick={() => { if (roundNumber === ROUNDS) setPhase("finished"); else void nextRound(roundNumber + 1); }}>{roundNumber === ROUNDS ? "See final score" : "Next verse →"}</button></div>}
            </>}
            {phase === "finished" && <div className="verse-game-intro"><div className="verse-game-compass" aria-hidden="true">✦</div><span className="verse-game-eyebrow">EXPEDITION COMPLETE</span><h3>{score.toLocaleString()} <small>/ 5,000</small></h3><p>Five verses explored. Ready for another journey?</p><button type="button" className="verse-game-primary" onClick={start}>Play again →</button></div>}
            {error && <p className="verse-game-error" role="alert">{error}</p>}
            {copyright && phase !== "intro" && <p className="verse-game-copyright">{copyright}</p>}
        </div>
    </section>;
}

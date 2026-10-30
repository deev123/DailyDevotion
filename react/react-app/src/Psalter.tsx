import { useEffect, useRef, useState } from "react";
import ListPicker from "./ListPicker.tsx";
import confetti from "canvas-confetti";
import GooeyCheckbox from "./GooeyCheckbox.tsx";
import Menu, { type MenuOption } from "./Menu.tsx";
import PassagePicker from "./PassagePicker.tsx";

type Setting = { heading: string; stanzas: string[] };
const references = Array.from({ length: 150 }, (_, i) => `Psalm ${i + 1}`);
const tunes = [
    { name: "Amazing Grace (instrumental)", file: "pd-amazing-grace.mp3" },
    { name: "Alas, and Did My Saviour Bleed (instrumental)", file: "pd-alas.mp3" },
    { name: "O for a Thousand Tongues (instrumental)", file: "pd-thousand-tongues.mp3" },
];

export default function Psalter({ id, layoutOptions }: { id: string; layoutOptions: MenuOption[] }) {
    const [index, setIndex] = useState(() => {
        const value = Number(localStorage.getItem(id + "_index"));
        return Number.isInteger(value) && value >= 0 && value < 150 ? value : 0;
    });
    const [psalms, setPsalms] = useState<Setting[][]>([]);
    const [error, setError] = useState(false);
    const [checked, setChecked] = useState(false);
    const [playerOpen, setPlayerOpen] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [tune, setTune] = useState(() => {
        const saved = localStorage.getItem(id + "_tune");
        const found = tunes.findIndex(item => item.file === saved);
        return found < 0 ? 0 : found;
    });
    const [speed, setSpeed] = useState(() => {
        const saved = localStorage.getItem(id + "_tuneSpeed");
        const value = saved === null || !saved.trim() ? 1 : Number(saved);
        return Number.isFinite(value) && value >= 0.5 && value <= 4 ? value : 1;
    });
    const initialTune = useRef(tunes[tune].file);
    const [audioError, setAudioError] = useState("");
    const audioRef = useRef<HTMLAudioElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const playRequest = useRef(0);
    useEffect(() => {
        const header = headerRef.current;
        const section = sectionRef.current;
        if (!header || !section) return;
        const update = () => section.style.setProperty("--passage-header-height", `${header.offsetHeight}px`);
        update();
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", update);
            return () => window.removeEventListener("resize", update);
        }
        const observer = new ResizeObserver(update);
        observer.observe(header);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const audio = audioRef.current;
        return () => { audio?.pause(); };
    }, []);
    useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed]);
    async function play() {
        const request = ++playRequest.current;
        try {
            setAudioError("");
            await audioRef.current?.play();
        } catch {
            if (request === playRequest.current) setAudioError("Could not play the tune. Please try again.");
        }
    }
    function pauseAndReset() {
        ++playRequest.current;
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
    }
    function changeTune(next: number) {
        const audio = audioRef.current;
        if (!audio) return;
        if (next === tune) { if (audio.paused) void play(); return; }
        ++playRequest.current;
        audio.pause();
        audio.src = `${import.meta.env.BASE_URL}psalter-tunes/${tunes[next].file}`;
        audio.load();
        audio.playbackRate = speed;
        setTune(next);
        localStorage.setItem(id + "_tune", tunes[next].file);
        setPlaying(false);
        setAudioError("");
        void play();
    }
    useEffect(() => {
        let cancelled = false;
        fetch(import.meta.env.BASE_URL + "Scottish_Psalter_1650.json")
            .then(response => { if (!response.ok) throw new Error("Failed to load psalter"); return response.json(); })
            .then(data => { if (!cancelled) setPsalms(data); })
            .catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; };
    }, []);
    function select(value: number) {
        setIndex(value);
        localStorage.setItem(id + "_index", String(value));
    }
    return <section ref={sectionRef}>
        <div ref={headerRef} className="passage-header integrated-passage-header">
            <PassagePicker references={references} value={index} onChange={select} />
            <button type="button" className="speech-icon-button speech-player-toggle" aria-label={playerOpen ? "Close tune player" : "Open tune player"}
                aria-expanded={playerOpen} aria-controls={`${id}-tune-player`} onClick={() => {
                    if (playerOpen) pauseAndReset();
                    setPlayerOpen(!playerOpen);
                }}><span className="material-icons" aria-hidden="true">{playerOpen ? "close" : "music_note"}</span></button>
            <Menu options={layoutOptions}><button className="dots-button" aria-label="Psalter options">⋮</button></Menu>
        </div>
        <audio ref={audioRef} src={`${import.meta.env.BASE_URL}psalter-tunes/${initialTune.current}`} loop preload="none"
            onPlay={() => setPlaying(!audioRef.current?.paused)} onPause={() => setPlaying(!audioRef.current?.paused)} onError={() => setAudioError("Could not load the tune.")} />
        {playerOpen && <div className="speech-disclosure speech-disclosure-open">
            <div id={`${id}-tune-player`} className="speech-mini-player" role="group" aria-label="Psalm tune player">
                <button type="button" className={`speech-icon-button${playing ? " speech-playing" : ""}`}
                    aria-label={playing ? "Pause tune" : "Play tune"} onClick={() => {
                        if (playing) pauseAndReset(); else void play();
                    }}>
                    <span className="material-icons" aria-hidden="true">{playing ? "pause" : "play_arrow"}</span>
                </button>
                <ListPicker title="Select tune" className="version-select psalter-tune-select" closeOnSelect={false}
                    options={tunes.map((item, i) => ({ value: i, label: item.name }))} value={tune} onChange={changeTune} />
                <label className="speech-mini-position psalter-speed">
                    <span>Speed {speed.toFixed(1)}×</span>
                    <input type="range" min="0.5" max="4" step="0.1" value={speed} aria-label="Tune speed"
                        aria-valuetext={`${speed.toFixed(1)} times`} onChange={event => {
                            const value = Number(event.target.value);
                            setSpeed(value);
                            localStorage.setItem(id + "_tuneSpeed", String(value));
                        }} />
                </label>
                {audioError && <p className="passage-error" role="alert">{audioError}</p>}
            </div>
        </div>}
        <div className="passage-body psalter-body">
            {error ? <p role="alert">Could not load the psalter.</p> : !psalms.length ? <p>Loading psalter…</p> :
                psalms[index]?.map((setting, i) => <div key={i}>
                    {setting.heading && <p className="psalter-heading">{setting.heading}</p>}
                    {setting.stanzas.map((stanza, j) => <p className="psalter-stanza" key={j}>{stanza.split(/(\^\d+)/).map((part, k) => /^\^\d+$/.test(part) ? <sup className="verse-number" key={k}>{part.slice(1)}</sup> : part)}</p>)}
                </div>)}
        </div>
        <div className="passage-footer"><GooeyCheckbox isChecked={checked} onChange={async () => {
            setChecked(true);
            confetti({ particleCount: 50, spread: 1000, origin: { y: 0.5 } });
            await new Promise(resolve => setTimeout(resolve, 1000));
            select((index + 1) % 150);
            setChecked(false);
        }} /></div>
    </section>;
}

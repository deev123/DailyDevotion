import { useEffect, useRef, useState } from "react";
import Menu, { type MenuOption } from "../../components/Menu";
import { loadTracks, saveTracks, type AudioTrack } from "./audioStorage";
import "./audio.css";

function time(seconds: number) {
    if (!Number.isFinite(seconds)) return "0:00";
    const value = Math.floor(seconds);
    const hours = Math.floor(value / 3600);
    return `${hours ? `${hours}:` : ""}${hours ? String(Math.floor(value / 60) % 60).padStart(2, "0") : Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
export default function AudioPlayer({ id, layoutOptions }: { id: string; layoutOptions: MenuOption[] }) {
    const [tracks, setTracks] = useState<AudioTrack[]>([]);
    const [selected, setSelected] = useState("");
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [rate, setRate] = useState(() => Number(localStorage.getItem(id + "_audioRate")) || 1);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [renaming, setRenaming] = useState("");
    const [draftName, setDraftName] = useState("");
    const audio = useRef<HTMLAudioElement>(null);
    const tracksRef = useRef<AudioTrack[]>([]);
    const selectedRef = useRef("");
    const saveQueue = useRef<Promise<void>>(Promise.resolve());
    const track = tracks.find(item => item.id === selected);
    function persist(next: AudioTrack[]) {
        tracksRef.current = next;
        setTracks(next);
        saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveTracks(id, next)).catch(() => { setError("Could not save audio files or progress. Check your browser storage and try again."); });
    }
    function savePosition(value: number) {
        if (!selectedRef.current || !Number.isFinite(value)) return;
        persist(tracksRef.current.map(item => item.id === selectedRef.current ? { ...item, position: value } : item));
    }
    useEffect(() => {
        let active = true;
        loadTracks(id).then(saved => { if (active) { tracksRef.current = saved; setTracks(saved); setSelected(saved[0]?.id ?? ""); } }).catch(() => { if (active) setError("Could not load saved audio files."); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id]);
    useEffect(() => {
        selectedRef.current = selected;
        setPosition(0); setDuration(0); setPlaying(false);
        if (!track || !audio.current) return;
        const element = audio.current;
        const url = URL.createObjectURL(track.file);
        element.src = url;
        element.load();
        return () => { element.pause(); URL.revokeObjectURL(url); };
    // Track metadata updates must not reload the audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);
    useEffect(() => { if (audio.current) audio.current.playbackRate = rate; localStorage.setItem(id + "_audioRate", String(rate)); }, [id, rate]);
    useEffect(() => {
        if (!playing) return;
        const timer = window.setInterval(() => { if (audio.current) savePosition(audio.current.currentTime); }, 5000);
        return () => window.clearInterval(timer);
    // The interval reads the current track through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing]);
    function choose(next: string) { if (audio.current) savePosition(audio.current.currentTime); setSelected(next); }
    return <section className="audio-player-section">
        <div className="audio-heading"><h2>Audio player</h2><Menu options={layoutOptions}><button type="button" className="player-icon-button" aria-label="Audio player options"><span className="material-icons" aria-hidden="true">more_vert</span></button></Menu></div>
        <div className="audio-actions"><label className="audio-add">Add audio files<input type="file" accept="audio/*,.mp3" multiple disabled={loading} onChange={event => {
            const files = Array.from(event.target.files ?? []); event.target.value = "";
            if (!files.length) return;
            const added = files.map(file => ({ id: crypto.randomUUID(), name: file.name, file, position: 0 }));
            persist([...tracksRef.current, ...added]); if (!selected) setSelected(added[0].id);
        }} /></label></div>
        {tracks.length > 0 && <div className="audio-track-list">{tracks.map(item => <div className="audio-track" key={item.id}>
            {renaming === item.id ? <form className="audio-rename" onSubmit={event => {
                event.preventDefault();
                const name = draftName.trim();
                if (!name) return;
                persist(tracksRef.current.map(current => current.id === item.id ? { ...current, name } : current));
                setRenaming("");
            }}>
                <input autoFocus aria-label="Track name" value={draftName} onChange={event => setDraftName(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setRenaming(""); }} required />
                <button type="submit" className="player-icon-button" aria-label="Save track name" title="Save"><span className="material-icons" aria-hidden="true">check</span></button>
                <button type="button" className="player-icon-button" aria-label="Cancel rename" title="Cancel" onClick={() => setRenaming("")}><span className="material-icons" aria-hidden="true">close</span></button>
            </form> : <>
                <button type="button" className={`audio-track-select${item.id === selected ? " audio-track-selected" : ""}`} aria-pressed={item.id === selected} onClick={() => choose(item.id)}>{item.name}<small>{time(item.position)}</small></button>
                <Menu options={[
                    { label: "Rename", action: () => { setDraftName(item.name); setRenaming(item.id); } },
                    { label: "Remove", action: () => { const next = tracksRef.current.filter(t => t.id !== item.id); if (selected === item.id) setSelected(next[0]?.id ?? ""); persist(next); } },
                ]}><button type="button" className="player-icon-button audio-track-options" aria-label={`Manage ${item.name}`} title="Manage track"><span className="material-icons" aria-hidden="true">edit_note</span></button></Menu>
            </>}
        </div>)}</div>}
        {!loading && !tracks.length && <p className="audio-empty">Add audio files to listen and save your place.</p>}
        <audio ref={audio} onLoadedMetadata={event => { const el = event.currentTarget; el.playbackRate = rate; const saved = tracksRef.current.find(item => item.id === selectedRef.current)?.position ?? 0; el.currentTime = Math.min(saved, Number.isFinite(el.duration) ? el.duration : saved); setPosition(el.currentTime); setDuration(Number.isFinite(el.duration) ? el.duration : 0); }} onTimeUpdate={event => setPosition(event.currentTarget.currentTime)} onPause={event => { setPlaying(false); savePosition(event.currentTarget.currentTime); }} onPlay={() => setPlaying(true)} onEnded={event => savePosition(event.currentTarget.currentTime)} onError={() => { if (selectedRef.current) setError("This audio file could not be played in your browser."); }} />
        {track && <div className="player-bar audio-controls" role="group" aria-label="Audio playback controls">
            <button type="button" className="player-icon-button" aria-label="Back 10 seconds" title="Back 10 seconds" onClick={() => { if (audio.current) { audio.current.currentTime = Math.max(0, audio.current.currentTime - 10); savePosition(audio.current.currentTime); } }}><span className="material-icons" aria-hidden="true">replay_10</span></button>
            <button type="button" className={`player-icon-button${playing ? " player-playing" : ""}`} aria-label={playing ? "Pause audio" : "Play audio"} onClick={() => { const el = audio.current; if (!el) return; if (el.paused) void el.play().catch(() => setError("Could not play this audio file.")); else el.pause(); }}><span className="material-icons" aria-hidden="true">{playing ? "pause" : "play_arrow"}</span></button>
            <div className="player-position"><span>{time(position)}</span><input type="range" aria-label="Audio position" min="0" max={duration || 0} step="0.1" value={Math.min(position, duration)} disabled={!duration} onChange={event => { if (audio.current) { audio.current.currentTime = Number(event.target.value); setPosition(audio.current.currentTime); savePosition(audio.current.currentTime); } }} /><span>{time(duration)}</span></div>
            <label className="audio-speed">Speed <select value={rate} onChange={event => setRate(Number(event.target.value))}>{[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
        </div>}
        {error && <p className="passage-error" role="alert">{error}</p>}
    </section>;
}

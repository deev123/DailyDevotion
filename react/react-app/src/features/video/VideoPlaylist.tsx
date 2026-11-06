import type { MenuOption } from "../../components/Menu.tsx"
import Menu from "../../components/Menu.tsx"
import ListPicker from "../../components/ListPicker.tsx"
import { useEffect, useState } from "react"
import VideoPlayer from "./VideoPlayer.tsx"
import type { VideoEntry } from "../../app/layoutStorage.ts"

type VideoPlaylistProps = { layoutOptions: MenuOption[]; id: string; list: string | VideoEntry[] };

function readIndex(key: string): number {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? "0");
        return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
    } catch { return 0; }
}

function readCustomVideos(id: string): VideoEntry[] {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(id + "_customVideos") ?? "[]");
        return Array.isArray(value) ? value.filter((item): item is VideoEntry =>
            item && typeof item.title === "string" && typeof item.videoId === "string" && /^[\w-]{11}$/.test(item.videoId)) : [];
    } catch { return []; }
}

function youtubeVideoId(input: string): string | null {
    try {
        const url = new URL(input.trim());
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        const host = url.hostname.toLowerCase();
        let videoId: string | null = null;
        if (host === "youtu.be" || host === "www.youtu.be") videoId = url.pathname.split("/")[1];
        else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
            const parts = url.pathname.split("/");
            videoId = url.pathname === "/watch" ? url.searchParams.get("v") : ["embed", "shorts", "live"].includes(parts[1]) ? parts[2] : null;
        }
        return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null;
    } catch { return null; }
}

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;
    let closedQuote = false;
    let afterComma = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (char === '"') { quoted = false; closedQuote = true; }
            else field += char;
        } else if (afterComma && (char === " " || char === "\t")) continue;
        else if (char === '"' && field === "" && !closedQuote) { quoted = true; afterComma = false; }
        else if (char === ",") { row.push(field); field = ""; closedQuote = false; afterComma = true; }
        else if (char === "\n" || char === "\r") {
            row.push(field); rows.push(row); row = []; field = ""; closedQuote = false; afterComma = false;
            if (char === "\r" && text[i + 1] === "\n") i++;
        } else if (closedQuote || char === '"') throw new Error("Check the quotes in your CSV.");
        else { field += char; afterComma = false; }
    }
    if (quoted) throw new Error("A quoted field is missing its closing quote.");
    if (field || row.length || closedQuote) { row.push(field); rows.push(row); }
    return rows;
}

function csvField(value: string): string {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function VideoPlaylist({ layoutOptions, id, list }: VideoPlaylistProps) {
    const [index, setIndex] = useState(() => readIndex(id + "_index"));
    const [customIndex, setCustomIndex] = useState(() => readIndex(id + "_customVideoIndex"));
    const [customVideos, setCustomVideos] = useState(() => readCustomVideos(id));
    const [custom, setCustom] = useState(() => {
        try { return localStorage.getItem(id + "_videoPlaylist") === "custom"; } catch { return false; }
    });
    const [videos, setVideos] = useState<VideoEntry[]>([]);
    const [editing, setEditing] = useState(false);
    const [textEditing, setTextEditing] = useState(false);
    const [playlistText, setPlaylistText] = useState("");
    const [link, setLink] = useState("");
    const [title, setTitle] = useState("");
    const [error, setError] = useState("");

    function save(key: string, value: string) {
        try { localStorage.setItem(id + key, value); return true; }
        catch { setError("Your playlist could not be saved on this device."); return false; }
    }
    function selectCustom(next: boolean) {
        setCustom(next);
        setEditing(false);
        setError("");
        save("_videoPlaylist", next ? "custom" : "bible");
    }
    function updateCustom(next: VideoEntry[], nextIndex: number) {
        setCustomVideos(next);
        setCustomIndex(nextIndex);
        const savedVideos = save("_customVideos", JSON.stringify(next));
        const savedIndex = save("_customVideoIndex", JSON.stringify(nextIndex));
        return savedVideos && savedIndex;
    }
    function addVideo() {
        const videoId = youtubeVideoId(link);
        if (!videoId) { setError("Enter a valid YouTube video link."); return; }
        if (customVideos.some(video => video.videoId === videoId)) { setError("This video is already in your custom playlist."); return; }
        setError("");
        updateCustom([...customVideos, { videoId, title: title.trim() || `Video ${customVideos.length + 1}` }], customIndex);
        setLink("");
        setTitle("");
    }
    function moveVideo(from: number, to: number) {
        if (to < 0 || to >= customVideos.length) return;
        const next = [...customVideos];
        [next[from], next[to]] = [next[to], next[from]];
        const selected = customIndex === from ? to : customIndex === to ? from : customIndex;
        updateCustom(next, selected);
    }
    function removeVideo(position: number) {
        const next = customVideos.filter((_, i) => i !== position);
        const selected = customIndex > position ? customIndex - 1 : Math.min(customIndex, Math.max(0, next.length - 1));
        updateCustom(next, selected);
    }
    function openTextEditor() {
        setPlaylistText(["title, url", ...customVideos.map(item => `${csvField(item.title)}, https://www.youtube.com/watch?v=${item.videoId}`)].join("\n"));
        setError("");
        setTextEditing(true);
    }
    function applyPlaylistText() {
        let rows: string[][];
        try { rows = parseCsv(playlistText); }
        catch (error) { setError(error instanceof Error ? error.message : "Invalid CSV."); return; }
        const header = rows.shift()?.map(value => value.trim().toLowerCase());
        if (!header || header.length !== 2 || !header.includes("title") || !header.includes("url")) {
            setError("The first row must contain the columns title and url."); return;
        }
        const titleColumn = header.indexOf("title");
        const urlColumn = header.indexOf("url");
        const entries: VideoEntry[] = [];
        const seen = new Set<string>();
        for (const [itemIndex, row] of rows.entries()) {
            if (row.every(field => !field.trim())) continue;
            if (row.length !== 2) { setError(`Video ${itemIndex + 1}: provide two columns, title and URL. Put titles containing commas in quotes.`); return; }
            const videoId = youtubeVideoId(row[urlColumn]);
            if (!videoId) { setError(`Video ${itemIndex + 1}: enter a valid YouTube video URL.`); return; }
            if (seen.has(videoId)) { setError(`Video ${itemIndex + 1}: this video appears more than once.`); return; }
            seen.add(videoId);
            entries.push({ videoId, title: row[titleColumn].trim() || `Video ${entries.length + 1}` });
        }
        const currentId = customVideos[customIndex]?.videoId;
        const selected = entries.findIndex(item => item.videoId === currentId);
        setError("");
        if (updateCustom(entries, selected >= 0 ? selected : 0)) setTextEditing(false);
    }

    useEffect(() => {
        // The index marks the component as present for player cleanup.
        try { localStorage.setItem(id + "_index", JSON.stringify(index)); } catch { /* Storage may be unavailable. */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (Array.isArray(list)) { setVideos(list); return; }
            try {
                const response = await fetch(import.meta.env.BASE_URL + list);
                if (!response.ok) throw new Error("Failed to load playlist");
                const data: unknown = await response.json();
                if (!Array.isArray(data)) throw new Error(`Invalid playlist: ${list}`);
                if (!cancelled) setVideos(data.filter((item): item is VideoEntry =>
                    item && typeof item.title === "string" && typeof item.videoId === "string"));
            } catch (loadError) { console.error(loadError); if (!cancelled) setError("Could not load the Bible playlist."); }
        }
        void load();
        return () => { cancelled = true; };
    }, [list]);

    const activeVideos = custom ? customVideos : videos;
    const activeIndex = custom ? customIndex : index;
    const video = activeVideos[activeIndex];
    return <section>
        <div className="passage-header">
            <ListPicker title="Select video" options={activeVideos.map((item, i) => ({ value: i, label: item.title }))}
                value={activeIndex} onChange={nextIndex => {
                    if (custom) { setCustomIndex(nextIndex); save("_customVideoIndex", JSON.stringify(nextIndex)); }
                    else { setIndex(nextIndex); save("_index", JSON.stringify(nextIndex)); }
                }} />
            <div><Menu options={layoutOptions}><button className="dots-button" aria-label="Playlist options">⋮</button></Menu></div>
        </div>
        <div className="video-playlist-controls">
            <label>Playlist <select disabled={textEditing} value={custom ? "custom" : "bible"} onChange={event => selectCustom(event.target.value === "custom")}>
                <option value="bible">Bible playlist</option><option value="custom">Custom playlist</option>
            </select></label>
            {custom && <button type="button" disabled={textEditing} onClick={() => { setEditing(!editing); setError(""); }}>{editing ? "Done editing" : "Edit playlist"}</button>}
        </div>
        {editing && custom && <div className="video-playlist-editor">
            {textEditing ? <>
                <label>Playlist text
                    <textarea rows={10} value={playlistText} onChange={event => setPlaylistText(event.target.value)} aria-describedby={`${id}-playlist-text-help`} />
                </label>
                <p id={`${id}-playlist-text-help`}>One video per row. Titles are optional; put titles containing commas in quotes. Saving replaces the custom playlist.</p>
                <pre className="video-playlist-example">{'title, url\nMy video, https://youtu.be/dQw4w9WgXcQ\n"A title, with a comma", https://youtu.be/9bZkp7q19f0'}</pre>
                <div className="video-editor-actions">
                    <button type="button" onClick={applyPlaylistText}>Save playlist</button>
                    <button type="button" onClick={() => { setTextEditing(false); setError(""); }}>Cancel</button>
                </div>
            </> : <>
            <button type="button" onClick={openTextEditor}>Edit as text</button>
            <form onSubmit={event => { event.preventDefault(); addVideo(); }}>
                <label>YouTube video link <input type="url" required value={link} onChange={event => setLink(event.target.value)} placeholder="https://youtube.com/watch?v=…" /></label>
                <label>Title (optional) <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Video title" /></label>
                <button type="submit">Add video</button>
            </form>
            <ol>{customVideos.map((item, position) => <li key={item.videoId}>
                <label>Title <input aria-label={`Title for video ${position + 1}`} value={item.title} onChange={event => {
                    const next = customVideos.map((entry, i) => i === position ? { ...entry, title: event.target.value } : entry);
                    updateCustom(next, customIndex);
                }} /></label>
                <div className="video-editor-actions">
                    <button type="button" disabled={position === 0} aria-label={`Move ${item.title || "video"} up`} onClick={() => moveVideo(position, position - 1)}>↑</button>
                    <button type="button" disabled={position === customVideos.length - 1} aria-label={`Move ${item.title || "video"} down`} onClick={() => moveVideo(position, position + 1)}>↓</button>
                    <button type="button" onClick={() => removeVideo(position)}>Remove</button>
                </div>
            </li>)}</ol>
            </>}
        </div>}
        {error && <p className="passage-error" role="alert">{error}</p>}
        {!editing && (video ? <VideoPlayer key={`${custom ? "custom" : "bible"}-${video.videoId}`} id={id} videoId={video.videoId} title={video.title || "YouTube video"} />
            : custom ? <p>No videos yet. Select Edit playlist to add YouTube links.</p> : videos.length > 0 ? <p>This video is unavailable. Select a video from the playlist.</p> : null)}
    </section>;
}

export default VideoPlaylist;

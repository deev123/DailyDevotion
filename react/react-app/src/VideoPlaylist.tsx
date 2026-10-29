import type { MenuOption } from "./Menu.tsx"
import Menu from "./Menu.tsx"
import ListPicker from "./ListPicker.tsx"
import { useEffect, useState } from "react"
import VideoPlayer from "./VideoPlayer.tsx"

type VideoPlaylistProps = {
    layoutOptions: MenuOption[],
    id: string,
    list: string
}

type Video = { title: string; videoId: string };

function VideoPlaylist({ layoutOptions, id, list }: VideoPlaylistProps) {
    const [index, setIndex] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(id + "_index") ?? "0");
            return Number.isInteger(saved) && saved >= 0 ? saved : 0;
        } catch { return 0; }
    });
    const [videos, setVideos] = useState<Video[]>([]);

    useEffect(() => {
        // The index also marks this component as present, so a late player
        // cleanup cannot recreate its saved position after it is deleted.
        try { localStorage.setItem(id + "_index", JSON.stringify(index)); } catch { /* Storage may be unavailable. */ }
        // The selection handler persists subsequent changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const response = await fetch(import.meta.env.BASE_URL + list);
                if (!response.ok) throw new Error("Failed to load playlist");
                const data: unknown = await response.json();
                if (!Array.isArray(data)) throw new Error(`Invalid playlist: ${list}`);
                if (!cancelled) setVideos(data.filter((item): item is Video =>
                    item && typeof item.title === "string" && typeof item.videoId === "string"));
            } catch (error) { console.error(error); }
        }
        load();
        return () => { cancelled = true; };
    }, [list]);

    const video = videos[index];
    return <section>
        <div className="passage-header">
            <ListPicker title="Select video" options={videos.map((item, i) => ({ value: i, label: item.title }))}
                value={index} onChange={nextIndex => {
                    setIndex(nextIndex);
                    try { localStorage.setItem(id + "_index", JSON.stringify(nextIndex)); } catch { /* Storage may be unavailable. */ }
                }} />
            <div><Menu options={layoutOptions}><button className="dots-button">⋮</button></Menu></div>
        </div>
        {video && <VideoPlayer key={video.videoId} id={id} videoId={video.videoId} title={video.title} />}
    </section>;
}

export default VideoPlaylist;

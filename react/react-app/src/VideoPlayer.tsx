import { useEffect, useRef, useState } from "react";
import { loadYouTubeApi, type YouTubePlayer } from "./youtubePlayer";

type Props = { id: string; videoId: string; title: string };

function readPositions(id: string): Record<string, number> {
    try {
        const stored: unknown = JSON.parse(localStorage.getItem(id + "_videoPositions") ?? "{}");
        if (stored && typeof stored === "object" && !Array.isArray(stored)) return stored as Record<string, number>;
    } catch { /* Ignore invalid or unavailable storage. */ }
    return {};
}

export default function VideoPlayer({ id, videoId, title }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [apiFailed, setApiFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let player: YouTubePlayer | null = null;
        let ready = false;
        let ended = false;
        let hasStarted = false;
        let allowZero = false;
        const saved = readPositions(id)[videoId];
        const start = typeof saved === "number" && Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;

        function savePosition() {
            // A deleted component removes its index before this effect cleans up.
            if (!ready || !player || !hasStarted) return;
            try {
                if (localStorage.getItem(id + "_index") === null) return;
                const time = ended ? 0 : player.getCurrentTime();
                if (!Number.isFinite(time) || time < 0) return;
                if (!ended && !allowZero && start > 0 && time === 0) return;
                const positions = readPositions(id);
                positions[videoId] = time;
                localStorage.setItem(id + "_videoPositions", JSON.stringify(positions));
            } catch { /* Playback remains usable when storage is unavailable. */ }
        }

        function onVisibilityChange() {
            if (document.visibilityState === "hidden") savePosition();
        }
        const timer = window.setInterval(savePosition, 1000);
        window.addEventListener("pagehide", savePosition);
        document.addEventListener("visibilitychange", onVisibilityChange);

        loadYouTubeApi().then(api => {
            if (cancelled || !containerRef.current) return;
            const target = document.createElement("div");
            containerRef.current.appendChild(target);
            player = new api.Player(target, {
                width: "100%", height: "400", videoId,
                playerVars: { rel: 0, playsinline: 1, origin: window.location.origin, start },
                events: {
                    onReady: event => {
                        if (cancelled) return;
                        player = event.target;
                        player.getIframe().title = title;
                        ready = true;
                    },
                    onStateChange: event => {
                        if (cancelled) return;
                        ended = event.data === 0;
                        if (event.data === 0 || event.data === 1 || event.data === 2) hasStarted = true;
                        if (event.data === 2) allowZero = true;
                        // Avoid replacing the saved start position with 0 before playback.
                        if (event.data === 0 || event.data === 1 || event.data === 2) savePosition();
                    },
                },
            });
        }).catch(() => { if (!cancelled) setApiFailed(true); });

        return () => {
            savePosition();
            cancelled = true;
            window.clearInterval(timer);
            window.removeEventListener("pagehide", savePosition);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            player?.destroy();
        };
    }, [id, videoId, title]);

    const fallbackStart = readPositions(id)[videoId];
    const start = typeof fallbackStart === "number" && Number.isFinite(fallbackStart) && fallbackStart > 0 ? Math.floor(fallbackStart) : 0;
    return <div className="video-container">
        {apiFailed ? <>
            <p role="status">Could not load playback tracking. You can still watch, but your position will not be saved.</p>
            <iframe title={title} width="100%" height="400"
                src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&start=${start}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </> : <div ref={containerRef} aria-label={title} />}
    </div>;
}

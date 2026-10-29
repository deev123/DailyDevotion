// Minimal types for the YouTube IFrame API used by the playlist player.
export type YouTubePlayer = {
    getCurrentTime(): number;
    getPlayerState(): number;
    getIframe(): HTMLIFrameElement;
    destroy(): void;
};

type PlayerEvent = { target: YouTubePlayer; data: number };
type YouTubeApi = {
    Player: new (element: HTMLElement, options: {
        width: string;
        height: string;
        videoId: string;
        playerVars: { rel: number; playsinline: number; origin: string; start: number };
        events: { onReady: (event: PlayerEvent) => void; onStateChange: (event: PlayerEvent) => void };
    }) => YouTubePlayer;
};

declare global {
    interface Window {
        YT?: YouTubeApi;
        onYouTubeIframeAPIReady?: () => void;
    }
}

let loading: Promise<YouTubeApi> | null = null;

/** Share the API script and ready callback across all playlist instances. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (loading) return loading;
    loading = new Promise<YouTubeApi>((resolve, reject) => {
        const previousReady = window.onYouTubeIframeAPIReady;
        const script = document.createElement("script");
        function cleanup() {
            window.clearTimeout(timer);
            if (window.onYouTubeIframeAPIReady === onReady) window.onYouTubeIframeAPIReady = previousReady;
            script.removeEventListener("error", onError);
        }
        function onReady() {
            cleanup();
            try { previousReady?.(); } finally {
                if (window.YT?.Player) resolve(window.YT);
                else reject(new Error("YouTube player API is unavailable."));
            }
        }
        function onError() {
            cleanup();
            script.remove();
            reject(new Error("Could not load the YouTube player API."));
        }
        window.onYouTubeIframeAPIReady = onReady;
        script.src = "https://www.youtube.com/iframe_api";
        script.addEventListener("error", onError);
        const timer = window.setTimeout(onError, 15000);
        document.head.appendChild(script);
    }).catch(error => {
        loading = null;
        throw error;
    });
    return loading;
}

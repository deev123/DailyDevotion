import { useEffect } from "react";

// Wake locks are released by the browser when a page becomes hidden. Reacquire
// on return while playback is still active, and release late requests on cleanup.
export function usePlaybackWakeLock(active: boolean) {
    useEffect(() => {
        if (!active || !("wakeLock" in navigator)) return;
        let disposed = false;
        let lock: WakeLockSentinel | null = null;
        let requestId = 0;

        async function acquire() {
            if (document.visibilityState !== "visible" || lock) return;
            const id = ++requestId;
            try {
                const next = await navigator.wakeLock.request("screen");
                if (disposed || id !== requestId || document.visibilityState !== "visible") {
                    await next.release();
                    return;
                }
                lock = next;
                next.addEventListener("release", () => { if (lock === next) lock = null; });
            } catch { /* Playback still works if the browser denies a wake lock. */ }
        }

        function visibilityChanged() {
            if (document.visibilityState === "visible") void acquire();
            else {
                requestId++;
                const previous = lock;
                lock = null;
                if (previous) void previous.release();
            }
        }
        void acquire();
        document.addEventListener("visibilitychange", visibilityChanged);
        return () => {
            disposed = true;
            requestId++;
            document.removeEventListener("visibilitychange", visibilityChanged);
            if (lock) void lock.release();
        };
    }, [active]);
}

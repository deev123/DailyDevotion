import { useLayoutEffect, useState, type RefObject } from "react";

/** Keep the last rendered passage height until its replacement is ready. */
export function useStableLoadingHeight(section: RefObject<HTMLElement | null>, loading: boolean, inheritedHeight?: number) {
    const [lastHeight, setLastHeight] = useState<number>();
    useLayoutEffect(() => {
        const element = section.current;
        if (loading || !element) return;
        const observer = new ResizeObserver(() => {
            const height = element.getBoundingClientRect().height;
            // Hidden tabs report zero height; retain their last visible measurement.
            if (height > 0) setLastHeight(previous => previous !== undefined && Math.abs(previous - height) < 0.5 ? previous : height);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [section, loading]);
    return loading ? lastHeight ?? inheritedHeight : undefined;
}

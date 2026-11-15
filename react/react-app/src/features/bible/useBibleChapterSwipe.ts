import { useEffect, useRef, type TouchEvent } from "react";

export function useBibleChapterSwipe({ index, count, enabled, direction, onNavigate }: {
    index: number; count: number; enabled: boolean; direction: number; onNavigate: (index: number) => void;
}) {
    const bodyRef = useRef<HTMLDivElement>(null);
    const swipeStart = useRef<{ x: number; y: number } | null>(null);
    const swipeBusy = useRef(false);
    const incomingSwipe = useRef(direction);
    const incomingConsumed = useRef(false);
    const swipeAnimation = useRef<Animation | null>(null);
    useEffect(() => () => swipeAnimation.current?.cancel(), []);

    function resetDrag() {
        if (bodyRef.current) bodyRef.current.style.transform = "";
        swipeStart.current = null;
    }
    function startSwipe(event: TouchEvent<HTMLElement>) {
        if (event.touches.length !== 1 || swipeBusy.current || !enabled ||
            (event.target as HTMLElement).closest("button, input, select, textarea, a, dialog, .player-bar")) return;
        swipeStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    function moveSwipe(event: TouchEvent<HTMLElement>) {
        const start = swipeStart.current;
        if (!start) return;
        if (event.touches.length !== 1) { resetDrag(); return; }
        const dx = event.touches[0].clientX - start.x;
        const dy = event.touches[0].clientY - start.y;
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { resetDrag(); return; }
        if (bodyRef.current && Math.abs(dx) > 12) {
            const blocked = dx > 0 ? index === 0 : index >= count - 1;
            bodyRef.current.style.transform = `translateX(${dx * (blocked ? 0.15 : 0.7)}px)`;
        }
    }
    async function finishSwipe(event: TouchEvent<HTMLElement>) {
        const start = swipeStart.current;
        if (!start || !event.changedTouches.length) return;
        swipeStart.current = null;
        const dx = event.changedTouches[0].clientX - start.x;
        const dy = event.changedTouches[0].clientY - start.y;
        const direction = dx < 0 ? 1 : -1;
        const target = index + direction;
        const body = bodyRef.current;
        if (!body) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || target < 0 || target >= count) {
            const from = body.style.transform || "translateX(0)";
            resetDrag();
            swipeAnimation.current = body.animate([{ transform: from }, { transform: "translateX(0)" }], { duration: reduced ? 0 : 160 });
            return;
        }
        swipeBusy.current = true;
        swipeAnimation.current = body.animate([
            { transform: body.style.transform || "translateX(0)", opacity: 1 },
            { transform: `translateX(${-direction * 100}%)`, opacity: 0 },
        ], { duration: reduced ? 0 : 150, easing: "ease-in", fill: "forwards" });
        try { await swipeAnimation.current.finished; } catch { return; }
        swipeAnimation.current.cancel();
        resetDrag();
        incomingSwipe.current = direction;
        onNavigate(target);
    }
    useEffect(() => {
        if (!enabled || incomingConsumed.current || !(incomingSwipe.current || direction) || !bodyRef.current) return;
        const incomingDirection = incomingSwipe.current || direction;
        incomingConsumed.current = true;
        incomingSwipe.current = 0;
        swipeBusy.current = false;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        swipeAnimation.current = bodyRef.current.animate([
            { transform: `translateX(${incomingDirection * 35}%)`, opacity: 0 },
            { transform: "translateX(0)", opacity: 1 },
        ], { duration: reduced ? 0 : 220, easing: "ease-out" });
    }, [enabled, direction]);
    return { bodyRef, onTouchStart: startSwipe, onTouchMove: moveSwipe, onTouchEnd: finishSwipe, onTouchCancel: resetDrag };
}

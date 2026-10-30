// Avoid restarting an in-progress smooth scroll at every word boundary.
const lastScrollByText = new WeakMap<HTMLElement, number>();

/** Keep the current highlighted word (or sentence) near the middle of the screen. */
export function followSpeechHighlight(text: HTMLElement): void {
    // A PDF sentence can span styled runs and invisible newline markers.
    const visible = (selector: string) => Array.from(text.querySelectorAll<HTMLElement>(selector))
        .find(element => element.getClientRects().length > 0);
    const target = visible(".speech-sentence-active mark") ?? visible(".speech-sentence-active");
    if (!target) return;
    const section = target.closest("section");
    const header = section?.querySelector<HTMLElement>(".passage-header");
    const player = section?.querySelector<HTMLElement>(".speech-mini-player");
    // The PDF player is already inside its sticky header; a passage player
    // sticks separately below the header.
    const top = 48 + (header?.offsetHeight ?? 0) + (player && !header?.contains(player) ? player.offsetHeight : 0) + 12;
    const bottom = 24;
    const availableHeight = Math.max(0, window.innerHeight - top - bottom);
    const center = top + availableHeight / 2;
    const rect = target.getBoundingClientRect();
    const targetCenter = (rect.top + rect.bottom) / 2;
    // Allow a central band so the screen doesn't move for every spoken word.
    if (Math.abs(targetCenter - center) <= availableHeight * 0.18) return;
    const now = Date.now();
    const lastScroll = lastScrollByText.get(text);
    if (lastScroll !== undefined && now - lastScroll < 500) return;
    lastScrollByText.set(text, now);
    target.style.scrollMarginTop = `${top}px`;
    target.style.scrollMarginBottom = `${bottom}px`;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "center", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
}

// PDF text items identify visual lines rather than semantic paragraphs. Keep
// their order and use unusually large baseline gaps as paragraph hints.
export type PdfTextItem = {
    str: string;
    transform: number[];
    height: number;
    width?: number;
    fontName?: string;
    hasEOL: boolean;
};
export type PdfFontStyle = { bold?: boolean; italic?: boolean };
type Run = { text: string; fontName?: string; height: number; accent: boolean; underline: boolean };
type Line = { runs: Run[]; text: string; x: number | null; y: number | null; right: number | null; height: number; ended: boolean };

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatPdfText(items: ReadonlyArray<PdfTextItem | { type: string }>,
    fonts: Readonly<Record<string, PdfFontStyle>> = {}, pageWidth = 0, accentItems: ReadonlySet<number> = new Set(), underlineItems: ReadonlySet<number> = new Set()): { text: string; html: string } {
    const lines: Line[] = [];
    const emptyLine = (): Line => ({ runs: [], text: "", x: null, y: null, right: null, height: 0, ended: false });
    let line = emptyLine();
    for (const [itemIndex, item] of items.entries()) {
        if (!("str" in item)) continue;
        const height = Number.isFinite(item.height) ? Math.abs(item.height) : 0;
        if (item.str && line.y === null && Number.isFinite(item.transform[5])) {
            line.y = item.transform[5];
            line.x = Number.isFinite(item.transform[4]) ? item.transform[4] : null;
        }
        if (item.str && Number.isFinite(item.transform[4]) && Number.isFinite(item.width)) {
            line.right = Math.max(line.right ?? -Infinity, item.transform[4] + Math.abs(item.width ?? 0));
        }
        line.height = Math.max(line.height, height);
        const next = items[itemIndex + 1];
        let space = "";
        if (!item.hasEOL && item.str && !/\s$/u.test(item.str) && next && "str" in next && next.str && !/^\s/u.test(next.str)) {
            // PDF.js can split a word at a font change. Add a space only if
            // geometry indicates a gap, or if positions are unavailable.
            const right = item.transform[4] + (item.width ?? NaN);
            const nextX = next.transform[4];
            if (!Number.isFinite(right) || !Number.isFinite(nextX) || nextX - right > Math.max(0.5, height * 0.12)) space = " ";
        }
        const text = item.str + space;
        line.text += text;
        line.runs.push({ text, fontName: item.fontName, height, accent: accentItems.has(itemIndex), underline: underlineItems.has(itemIndex) });
        if (item.hasEOL) {
            line.ended = true;
            lines.push(line);
            line = emptyLine();
        }
    }
    if (line.text) lines.push(line);

    const gaps = lines.slice(1).map((next, index) => {
        const previous = lines[index];
        return previous.y !== null && next.y !== null ? Math.abs(previous.y - next.y) : 0;
    }).filter(gap => gap > 0).sort((a, b) => a - b);
    const typicalGap = gaps.length >= 2 ? gaps[Math.floor((gaps.length - 1) / 2)] : 0;
    // Weight the font baseline by text length, so a large heading cannot set
    // the body size for the whole page.
    const sizes = lines.flatMap(current => current.runs.filter(run => run.height > 0 && /\S/u.test(run.text))
        .map(run => ({ height: run.height, weight: run.text.trim().length })));
    sizes.sort((a, b) => a.height - b.height);
    const halfWeight = sizes.reduce((sum, size) => sum + size.weight, 0) / 2;
    let total = 0;
    const bodySize = sizes.find(size => (total += size.weight) >= halfWeight)?.height ?? 0;
    const positions = lines.filter(current => current.x !== null && current.text.trim().length > 0).map(current => current.x!).sort((a, b) => a - b);
    const leftEdge = positions.length ? positions[Math.floor((positions.length - 1) * 0.15)] : 0;

    let text = "";
    let html = "";
    lines.forEach((current, index) => {
        const next = lines[index + 1];
        let extraBreak = false;
        if (next && current.y !== null && next.y !== null && typicalGap > 0) {
            const gap = Math.abs(current.y - next.y);
            extraBreak = gap > typicalGap * 1.45 && gap > Math.max(current.height, next.height) * 1.4;
        }
        const separator = current.ended ? (extraBreak ? "\n\n" : "\n") : "";
        text += current.text + separator;
        const classes = ["pdf-text-line"];
        if (!current.text.trim()) classes.push("pdf-text-empty");
        if (extraBreak) classes.push("pdf-text-gap");
        if (bodySize && current.height > bodySize * 1.22 && current.text.trim().length < 140) classes.push("pdf-text-heading");
        if (/^\s*(?:[•●◦▪‣⁃*-]|\d+[.)]|[a-zA-Z][.)])\s+/u.test(current.text)) classes.push("pdf-text-list");
        if (current.x !== null && bodySize > 0) {
            const indent = Math.min(4, Math.max(0, Math.round((current.x - leftEdge) / (bodySize * 1.5))));
            if (indent) classes.push(`pdf-text-indent-${indent}`);
            if (pageWidth > 0 && current.right !== null && current.right > current.x && current.right - current.x < pageWidth * 0.7) {
                const leftMargin = current.x;
                const rightMargin = pageWidth - current.right;
                if (leftMargin > bodySize * 2 && rightMargin > bodySize * 2 && Math.abs(leftMargin - rightMargin) < pageWidth * 0.08) classes.push("pdf-text-center");
                else if (rightMargin >= 0 && leftMargin > rightMargin * 2 && leftMargin > pageWidth * 0.35) classes.push("pdf-text-right");
            }
        }
        const runs = current.runs.map(run => {
            const font = run.fontName ? fonts[run.fontName] : undefined;
            const sizeClass = bodySize && run.height > bodySize * 1.15 ? "pdf-text-large"
                : bodySize && run.height > 0 && run.height < bodySize * 0.8 ? "pdf-text-small" : "";
            let markup = escapeHtml(run.text);
            if (run.underline) markup = `<u>${markup}</u>`;
            if (font?.italic) markup = `<em>${markup}</em>`;
            if (font?.bold) markup = `<strong>${markup}</strong>`;
            const classes = [sizeClass, run.accent ? "pdf-text-accent" : ""].filter(Boolean).join(" ");
            return classes ? `<span class="${classes}">${markup}</span>` : markup;
        }).join("");
        html += `<span class="${classes.join(" ")}">${runs}</span>${separator ? `<span class="pdf-text-separator">${separator}</span>` : ""}`;
    });
    return { text, html: `<div class="pdf-formatted-text">${html}</div>` };
}

export function extractPdfText(items: ReadonlyArray<PdfTextItem | { type: string }>): string {
    return formatPdfText(items).text;
}

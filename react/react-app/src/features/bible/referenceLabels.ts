const abbreviations: Record<string, string> = {
    psalm: "Ps", psalms: "Ps", samuel: "Sam", chronicles: "Chr", corinthians: "Cor",
    "song of solomon": "Song", "song of songs": "Song", ecclesiastes: "Eccl",
    john: "John", joshua: "Josh", judges: "Judg", jude: "Jude", philippians: "Phil",
    philemon: "Phlm", thessalonians: "Thess", timothy: "Tim",
};

/** Shorten the book name progressively, preserving its ordinal and verse reference. */
export function referenceLabels(reference: string): string[] {
    const match = reference.trim().match(/^(.+?)\s+(\p{N}+(?::\p{N}+)?(?:[-–]\p{N}+(?::\p{N}+)?)?)$/u);
    if (!match) return [reference];
    const numbered = match[1].match(/^([1-3١-٣۱-۳])\s*(.+)$/u) ?? match[1].match(/^(I{1,3})\s+(.+)$/u);
    const ordinal = numbered?.[1] ?? "";
    const book = numbered?.[2] ?? match[1];
    const characters = typeof Intl.Segmenter === "function"
        ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(book), part => part.segment)
        : Array.from(book);
    const abbreviated = abbreviations[book.toLowerCase()] ?? characters.slice(0, 3).join("");
    const prefix = ordinal ? `${ordinal} ` : "";
    return [...new Set([reference, `${prefix}${abbreviated} ${match[2]}`])];
}

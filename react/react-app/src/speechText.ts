export type SpeechSegment = { text: string; index: number };
export type SpeechFragment = { text: string; index?: number; offset?: number };

/** Map sentence segments back to the inline text nodes they cross. */
export function segmentInlineText(chunks: string[], language: string): { sentences: SpeechSegment[]; fragments: SpeechFragment[][] } {
    const text = chunks.join("");
    let segmenter: Intl.Segmenter | null = null;
    if (typeof Intl.Segmenter !== "undefined") {
        try { segmenter = new Intl.Segmenter(language || "en", { granularity: "sentence" }); }
        catch { segmenter = new Intl.Segmenter("en", { granularity: "sentence" }); }
    }
    const segments = segmenter
        ? Array.from(segmenter.segment(text), item => ({ text: item.segment, start: item.index }))
        : Array.from(text.matchAll(/[^.!?。！？]+[.!?。！？]*\s*/gu), item => ({ text: item[0], start: item.index }));
    const readable = segments.filter(segment => /[\p{L}\p{N}]/u.test(segment.text))
        .map((segment, index) => ({ ...segment, index, end: segment.start + segment.text.length }));
    const sentences = readable.map(segment => ({ text: segment.text, index: segment.index }));
    let nodeStart = 0;
    let segmentIndex = 0;
    const fragments = chunks.map(chunk => {
        const nodeEnd = nodeStart + chunk.length;
        const result: SpeechFragment[] = [];
        let cursor = nodeStart;
        while (segmentIndex < readable.length && readable[segmentIndex].end <= nodeStart) segmentIndex++;
        let index = segmentIndex;
        while (index < readable.length && readable[index].start < nodeEnd) {
            const segment = readable[index];
            const start = Math.max(nodeStart, segment.start);
            const end = Math.min(nodeEnd, segment.end);
            if (start > cursor) result.push({ text: chunk.slice(cursor - nodeStart, start - nodeStart) });
            if (end > start) {
                result.push({ text: chunk.slice(start - nodeStart, end - nodeStart), index: segment.index, offset: start - segment.start });
                cursor = end;
            }
            index++;
        }
        if (cursor < nodeEnd) result.push({ text: chunk.slice(cursor - nodeStart) });
        nodeStart = nodeEnd;
        return result;
    });
    return { sentences, fragments };
}

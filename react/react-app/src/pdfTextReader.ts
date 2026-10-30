import type { PDFPageProxy } from "pdfjs-dist";
import { getPdfAccentItems, getPdfUnderlineItems } from "./pdfColor.ts";
import { formatPdfText } from "./pdfText.ts";
import type { PdfFontStyle } from "./pdfText.ts";

type PdfFontInfo = {
    name?: string;
    bold?: boolean;
    black?: boolean;
    italic?: boolean;
    cssFontInfo?: { fontFamily?: string; fontWeight?: string | number; italicAngle?: string | number };
    systemFontInfo?: { baseFontName?: string; css?: string };
};

function fontStyle(font: unknown, family = ""): PdfFontStyle {
    const info: PdfFontInfo = font && typeof font === "object" ? font as PdfFontInfo : {};
    const weight = info.cssFontInfo?.fontWeight;
    const fontNames = [info.name, info.cssFontInfo?.fontFamily, info.systemFontInfo?.baseFontName, family]
        .filter((name): name is string => typeof name === "string").join(" ");
    return {
        bold: !!(info.bold || info.black || (typeof weight === "string" && /^(?:bold|bolder)$/iu.test(weight))
            || (weight !== undefined && Number(weight) >= 600) || /(?:bold|demi|heavy|black)/iu.test(fontNames)),
        italic: !!(info.italic || (info.cssFontInfo?.italicAngle && Number(info.cssFontInfo.italicAngle) !== 0)
            || /(?:italic|oblique)/iu.test(fontNames)),
    };
}

// Font flags live on PDF.js's resolved font objects rather than in the text
// content API. Show text promptly, then update styling if a font loads later.
export async function readPdfText(page: PDFPageProxy, onFontUpdate?: (result: { text: string; html: string }) => void): Promise<{ text: string; html: string }> {
    const [content, operators] = await Promise.all([
        page.getTextContent(),
        page.getOperatorList().catch(() => null),
    ]);
    const names = [...new Set(content.items.flatMap(item => "str" in item ? [item.fontName] : []))];
    const fontStyles: Record<string, PdfFontStyle> = {};
    const accents = operators ? getPdfAccentItems(content.items, operators) : new Set<number>();
    const underlines = operators ? getPdfUnderlineItems(content.items, operators) : new Set<number>();
    const pageWidth = page.getViewport({ scale: 1 }).width;
    const format = () => formatPdfText(content.items, fontStyles, pageWidth, accents, underlines);
    let initialReady = false;
    await Promise.all(names.map(name => new Promise<void>(resolve => {
        let finished = false;
        const family = content.styles[name]?.fontFamily ?? "";
        fontStyles[name] = fontStyle(undefined, family);
        const finish = (font?: unknown) => {
            const previous = fontStyles[name];
            const updated = fontStyle(font, family);
            fontStyles[name] = updated;
            if (finished) {
                if (initialReady && (previous.bold !== updated.bold || previous.italic !== updated.italic)) onFontUpdate?.(format());
                return;
            }
            finished = true;
            clearTimeout(timer);
            resolve();
        };
        const timer = setTimeout(() => finish(), 750);
        try {
            if (page.commonObjs.has(name)) finish(page.commonObjs.get(name));
            else page.commonObjs.get(name, finish);
        } catch { finish(); }
    })));
    const result = format();
    initialReady = true;
    return result;
}

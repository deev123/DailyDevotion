import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfTextItem } from "./pdfText.ts";

type OperatorList = { fnArray: number[]; argsArray: unknown[] };

// Match glyphs to extracted text only when their non-whitespace characters
// agree exactly. If PDF.js reorders or substitutes text, leave it uncoloured.
export function getPdfAccentItems(items: ReadonlyArray<PdfTextItem | { type: string }>, operators: OperatorList): Set<number> {
    let fill = "#000000";
    const stack: string[] = [];
    const glyphs: { char: string; accent: boolean }[] = [];
    const isAccent = (color: string) => {
        if (!/^#[\da-f]{6}$/iu.test(color)) return false;
        const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
        return Math.max(...channels) - Math.min(...channels) >= 40;
    };
    operators.fnArray.forEach((operation, index) => {
        const args = operators.argsArray[index];
        if (operation === OPS.save) stack.push(fill);
        else if (operation === OPS.restore) fill = stack.pop() ?? "#000000";
        else if (operation === OPS.setFillRGBColor && Array.isArray(args) && typeof args[0] === "string") fill = args[0];
        else if (operation === OPS.showText && Array.isArray(args) && Array.isArray(args[0])) {
            for (const glyph of args[0]) {
                if (!glyph || typeof glyph !== "object" || typeof glyph.unicode !== "string") continue;
                for (const char of glyph.unicode) if (!/\s/u.test(char)) glyphs.push({ char, accent: isAccent(fill) });
            }
        }
    });
    const extracted = items.flatMap((item, index) => "str" in item
        ? Array.from(item.str).filter(char => !/\s/u.test(char)).map(char => ({ char, index })) : []);
    if (glyphs.length !== extracted.length || extracted.some((item, index) => item.char !== glyphs[index].char)) return new Set();
    const colors = new Map<number, boolean[]>();
    extracted.forEach((item, index) => {
        const values = colors.get(item.index) ?? [];
        values.push(glyphs[index].accent);
        colors.set(item.index, values);
    });
    return new Set([...colors].filter(([, values]) => values.length > 0 && values.every(Boolean)).map(([index]) => index));
}

// PDF underlines are commonly thin stroked lines rather than text attributes.
// Only treat a horizontal line immediately below a text baseline as an
// underline; other drawing operations remain part of the rendered PDF page.
export function getPdfUnderlineItems(items: ReadonlyArray<PdfTextItem | { type: string }>, operators: OperatorList): Set<number> {
    type Matrix = [number, number, number, number, number, number];
    let matrix: Matrix = [1, 0, 0, 1, 0, 0];
    const stack: Matrix[] = [];
    const rules: { left: number; right: number; y: number }[] = [];
    operators.fnArray.forEach((operation, index) => {
        const args = operators.argsArray[index];
        if (operation === OPS.save) stack.push([...matrix]);
        else if (operation === OPS.restore) matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0];
        else if (operation === OPS.transform && Array.isArray(args) && args.length === 6 && args.every(Number.isFinite)) {
            const [a, b, c, d, e, f] = matrix;
            const [g, h, i, j, k, l] = args as Matrix;
            matrix = [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f];
        } else if (operation === OPS.constructPath && Array.isArray(args) && args[0] === OPS.stroke && args[2]) {
            const bounds = Array.from(args[2] as ArrayLike<number>);
            if (bounds.length !== 4 || !bounds.every(Number.isFinite)) return;
            const [x1, y1, x2, y2] = bounds;
            const [a, b, c, d, e, f] = matrix;
            const corners = [[x1, y1], [x1, y2], [x2, y1], [x2, y2]].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
            const xs = corners.map(point => point[0]);
            const ys = corners.map(point => point[1]);
            const left = Math.min(...xs), right = Math.max(...xs);
            const bottom = Math.min(...ys), top = Math.max(...ys);
            if (right - left > 2 && top - bottom <= 1.5) rules.push({ left, right, y: (top + bottom) / 2 });
        }
    });
    const underlined = new Set<number>();
    items.forEach((item, index) => {
        if (!("str" in item) || !item.str.trim() || !Number.isFinite(item.width) || !item.width || item.width <= 0) return;
        const x = item.transform[4], y = item.transform[5], height = Math.abs(item.height);
        if (![x, y, height].every(Number.isFinite) || height <= 0) return;
        if (rules.some(rule => {
            const distance = y - rule.y;
            const overlap = Math.min(x + item.width!, rule.right) - Math.max(x, rule.left);
            return distance >= 0 && distance <= Math.max(3, height * 0.35)
                && overlap >= item.width! * 0.8 && rule.right - rule.left <= item.width! * 4;
        })) underlined.add(index);
    });
    return underlined;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Bundle the TypeScript source so the integration test works on Node versions
// which do not support TypeScript imports natively.
const bundle = await build({ entryPoints: [new URL('../src/pdfTextReader.ts', import.meta.url).pathname],
    bundle: true, write: false, format: 'esm', platform: 'node', external: ['pdfjs-dist/*'], logLevel: 'silent' });
const code = bundle.outputFiles[0].text.replaceAll('"pdfjs-dist/legacy/build/pdf.mjs"', JSON.stringify(import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs')));
const { readPdfText } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

function samplePdf() {
    const content = 'BT /F1 12 Tf 40 700 Td (Normal ) Tj 1 0 0 rg /F2 12 Tf (Bold ) Tj /F3 12 Tf (Italic) Tj ET 0 0 0 RG 1 w 40 698 m 77 698 l S';
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>',
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Uint8Array(Buffer.from(pdf));
}

test('reads real PDF font and drawing data into themed markup', async () => {
    const task = getDocument({ data: samplePdf(), disableFontFace: true, useSystemFonts: true });
    try {
        const page = await (await task.promise).getPage(1);
        const result = await readPdfText(page);
        assert.match(result.text, /Normal\s+Bold\s+Italic/);
        assert.match(result.html, /<u>Normal\s*<\/u>/);
        assert.match(result.html, /pdf-text-accent[^>]*><strong>Bold\s*<\/strong>/);
        assert.match(result.html, /<em>Italic\s*<\/em>/);
    } finally { await task.destroy(); }
});

function mockedPage(fontObjects) {
    const items = [
        { str: 'Regular text ', fontName: 'regular', height: 12, width: 72, transform: [1, 0, 0, 1, 20, 100], hasEOL: false },
        { str: 'small bold', fontName: 'small', height: 8, width: 40, transform: [1, 0, 0, 1, 92, 100], hasEOL: true },
    ];
    return {
        getTextContent: async () => ({ items, styles: { regular: { fontFamily: 'sans-serif' }, small: { fontFamily: 'sans-serif' } } }),
        getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
        getViewport: () => ({ width: 400 }),
        commonObjs: fontObjects,
    };
}

test('preserves smaller bold text identified by weight or font name', async () => {
    for (const font of [{ cssFontInfo: { fontWeight: '600' } }, { name: 'Example-Demi' }, { bold: true }]) {
        const page = mockedPage({ has: () => true, get: name => name === 'small' ? font : {} });
        const result = await readPdfText(page);
        assert.match(result.html, /pdf-text-small[^>]*><strong>small bold<\/strong>/);
        assert.doesNotMatch(result.html, /<strong>Regular text/);
    }
});

test('updates formatting when a bold font resolves after the initial wait', async () => {
    let resolveFont;
    let updated;
    const updatePromise = new Promise(resolve => { updated = resolve; });
    const page = mockedPage({
        has: name => name === 'regular',
        get: (name, callback) => { if (name === 'small') resolveFont = callback; else return {}; },
    });
    const initial = await readPdfText(page, result => updated(result));
    assert.doesNotMatch(initial.html, /<strong>small bold/);
    resolveFont({ bold: true });
    const next = await updatePromise;
    assert.match(next.html, /<strong>small bold<\/strong>/);
    assert.equal(next.text, initial.text);
});

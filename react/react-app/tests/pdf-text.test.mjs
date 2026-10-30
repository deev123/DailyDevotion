import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pdfText.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { extractPdfText } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const line = (str, y, overrides = {}) => ({ str, transform: [1, 0, 0, 1, 0, y], height: 10, hasEOL: true, ...overrides });

test('ordinary wrapped lines stay single-spaced and larger gaps get a blank line', () => {
    assert.equal(extractPdfText([line('First line', 100), line('continues here', 88), line('New paragraph', 64), line('continues', 52)]),
        'First line\ncontinues here\n\nNew paragraph\ncontinues\n');
});

test('preserves explicit empty lines and combines items on the same line', () => {
    assert.equal(extractPdfText([line('Hello', 100, { hasEOL: false }), line('world', 100), line('', 0), line('Next', 76)]),
        'Hello world\n\nNext\n');
});

test('leaves line breaks alone if there is too little layout information', () => {
    assert.equal(extractPdfText([line('First', 100), line('Second', 50)]), 'First\nSecond\n');
    assert.equal(extractPdfText([{ type: 'beginMarkedContent' }, line('Unfinished', 100, { hasEOL: false })]), 'Unfinished');
});

const { formatPdfText } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('applies font styles, relative headings, indentation and themed accents safely', () => {
    const items = [
        line('Title', 740, { transform: [1, 0, 0, 1, 240, 740], width: 120, height: 20, fontName: 'bold' }),
        line('Plain <text> ', 700, { transform: [1, 0, 0, 1, 50, 700], width: 95, height: 10, fontName: 'regular', hasEOL: false }),
        line('emphasis', 700, { transform: [1, 0, 0, 1, 145, 700], width: 45, height: 10, fontName: 'italic' }),
        line('• First item', 688, { transform: [1, 0, 0, 1, 80, 688], width: 70, height: 10, fontName: 'regular' }),
        line('Second body line', 676, { transform: [1, 0, 0, 1, 50, 676], width: 120, height: 10, fontName: 'regular' }),
    ];
    const result = formatPdfText(items, { bold: { bold: true }, italic: { italic: true } }, 600, new Set([2]));
    assert.match(result.html, /pdf-text-heading/);
    assert.match(result.html, /pdf-text-center/);
    assert.match(result.html, /<strong>Title<\/strong>/);
    assert.match(result.html, /pdf-text-accent[^>]*><em>emphasis<\/em>/);
    assert.match(result.html, /pdf-text-list/);
    assert.match(result.html, /pdf-text-indent-2/);
    assert.match(result.html, /&lt;text&gt;/);
    assert.ok(result.text.includes('Plain <text> emphasis'));
});

test('formats independently of speech text and leaves unknown fonts unstyled', () => {
    const items = [line('Only text', 100, { fontName: 'unknown' })];
    const result = formatPdfText(items);
    assert.equal(result.text, 'Only text\n');
    assert.doesNotMatch(result.html, /<(?:strong|em)>/);
});

test('keeps a word together when a font change does not introduce a gap', () => {
    const items = [
        line('un', 100, { hasEOL: false, width: 10, transform: [1, 0, 0, 1, 50, 100] }),
        line('broken', 100, { width: 30, transform: [1, 0, 0, 1, 60, 100] }),
    ];
    assert.equal(formatPdfText(items).text, 'unbroken\n');
    assert.match(formatPdfText(items).html, /pdf-text-separator/);
});

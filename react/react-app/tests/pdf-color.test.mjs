import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const source = readFileSync(new URL('../src/pdfColor.ts', import.meta.url), 'utf8').replace('import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs";', `const OPS = ${JSON.stringify(OPS)};`);
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { getPdfAccentItems } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const glyphs = text => [Array.from(text, unicode => ({ unicode }))];
const items = [{ str: 'Normal' }, { str: ' ' }, { str: 'Red' }, { str: ' Back' }];

test('maps coloured runs to a themed accent and respects saved graphics state', () => {
    const operators = { fnArray: [OPS.showText, OPS.save, OPS.setFillRGBColor, OPS.showText, OPS.restore, OPS.showText],
        argsArray: [glyphs('Normal '), null, ['#ff0000'], glyphs('Red'), null, glyphs(' Back')] };
    assert.deepEqual([...getPdfAccentItems(items, operators)], [2]);
});

test('does not guess colours when glyph and extracted text do not match', () => {
    assert.deepEqual([...getPdfAccentItems(items, { fnArray: [OPS.setFillRGBColor, OPS.showText], argsArray: [['#ff0000'], glyphs('different')] })], []);
});

test('recognizes a stroked underline immediately below text and ignores distant rules', async () => {
    const { getPdfUnderlineItems } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
    const textItems = [{ str: 'Underlined', transform: [1, 0, 0, 1, 40, 700], height: 12, width: 60 }];
    const operators = { fnArray: [OPS.constructPath], argsArray: [[OPS.stroke, [], [40, 698, 100, 698]]] };
    assert.deepEqual([...getPdfUnderlineItems(textItems, operators)], [0]);
    operators.argsArray[0][2] = [40, 650, 100, 650];
    assert.deepEqual([...getPdfUnderlineItems(textItems, operators)], []);
});

test('accounts for a transformed underline and a saved graphics state', async () => {
    const { getPdfUnderlineItems } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
    const textItems = [{ str: 'Underlined', transform: [1, 0, 0, 1, 40, 700], height: 12, width: 60 }];
    const operators = { fnArray: [OPS.save, OPS.transform, OPS.constructPath, OPS.restore],
        argsArray: [null, [1, 0, 0, 1, 40, 698], [OPS.stroke, [], [0, 0, 60, 0]], null] };
    assert.deepEqual([...getPdfUnderlineItems(textItems, operators)], [0]);
});

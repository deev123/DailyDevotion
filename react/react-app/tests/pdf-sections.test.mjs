import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pdfSections.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { loadPdfSections, savePdfSections } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
after(() => { delete globalThis.localStorage; });

test('restores each PDF reader independently with the original defaults', () => {
    values.clear();
    const defaults = { page: true, text: false, showPage: true, showText: true, zoom: 1, runner: false, speech: false };
    assert.deepEqual(loadPdfSections('one'), defaults);
    const open = { page: false, text: true, showPage: false, showText: false, zoom: 1.5, runner: true, speech: true };
    savePdfSections('one', open);
    assert.deepEqual(loadPdfSections('one'), open);
    assert.deepEqual(loadPdfSections('two'), defaults);
});

test('handles old, malformed and inaccessible browser storage', () => {
    values.clear();
    values.set('one_pdfSections', '{invalid');
    assert.deepEqual(loadPdfSections('one'), { page: true, text: false, showPage: true, showText: true, zoom: 1, runner: false, speech: false });
    values.set('one_pdfSections', JSON.stringify({ page: false, text: 'yes', speech: true }));
    assert.deepEqual(loadPdfSections('one'), { page: false, text: false, showPage: true, showText: true, zoom: 1, runner: false, speech: true });
    const storage = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => { throw new Error('unavailable'); }, setItem: () => { throw new Error('unavailable'); } };
    assert.equal(loadPdfSections('one').page, true);
    assert.doesNotThrow(() => savePdfSections('one', loadPdfSections('one')));
    globalThis.localStorage = storage;
});

test('migrates saved section state and validates display settings', () => {
    values.clear();
    values.set('one_pdfSections', JSON.stringify({ page: false, text: true, display: true, zoom: 999, showPage: 'yes', showText: false }));
    assert.deepEqual(loadPdfSections('one'), {
        page: false, text: true, showPage: true, showText: false, zoom: 1, runner: false, speech: false,
    });
    const previous = loadPdfSections('one');
    savePdfSections('one', { ...previous, showPage: false, zoom: 2 });
    const restored = loadPdfSections('one');
    assert.equal(restored.showPage, false);
    assert.equal(restored.page, false);
    assert.equal(restored.showText, false);
    assert.equal(restored.text, true);
    assert.equal(restored.zoom, 2);
});

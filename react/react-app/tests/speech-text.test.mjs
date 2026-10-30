import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/speechText.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { segmentInlineText } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('keeps a sentence whole across normal, bold and italic text nodes', () => {
    const chunks = ['Hello ', 'bold', ' and ', 'italic', ' world. ', 'Next sentence.'];
    const result = segmentInlineText(chunks, 'en');
    assert.deepEqual(result.sentences.map(item => item.text), ['Hello bold and italic world. ', 'Next sentence.']);
    assert.deepEqual(result.fragments.map(parts => parts.map(part => part.text).join('')), chunks);
    assert.equal(result.fragments[1][0].index, 0);
    assert.equal(result.fragments[1][0].offset, 6);
    assert.equal(result.fragments[3][0].offset, 15);
    assert.equal(result.fragments[5][0].index, 1);
});

test('preserves line breaks, blank text and sentence offsets across node boundaries', () => {
    const chunks = ['A ', 'sentence', '\n', 'continues. Next', ' one.'];
    const result = segmentInlineText(chunks, 'en');
    assert.deepEqual(result.sentences.map(item => item.text), ['A sentence\n', 'continues. ', 'Next one.']);
    assert.deepEqual(result.fragments.map(parts => parts.map(part => part.text).join('')), chunks);
    assert.deepEqual(result.fragments[3].map(part => part.index), [1, 2]);
    assert.equal(result.fragments[4][0].offset, 4);
    assert.deepEqual(segmentInlineText([' ', '\n'], 'en').sentences, []);
});

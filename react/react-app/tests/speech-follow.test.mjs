import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/speechFollow.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { followSpeechHighlight } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
globalThis.window = { innerHeight: 800 };
after(() => { delete globalThis.window; });

function fakeTarget(top, bottom, options = {}) {
    let scrolls = 0;
    let scrollOptions;
    const player = { offsetHeight: 40 };
    const header = { offsetHeight: 60, contains: () => !!options.playerInsideHeader };
    const target = {
        style: {},
        getClientRects: () => options.hidden ? [] : [{}],
        getBoundingClientRect: () => ({ top, bottom }),
        closest: () => ({ querySelector: selector => selector === '.passage-header' ? header : player }),
        scrollIntoView: options => { scrolls++; scrollOptions = options; },
    };
    return { target, scrolls: () => scrolls, scrollOptions: () => scrollOptions };
}

test('leaves a highlight near the middle in place', () => {
    const visible = fakeTarget(450, 470);
    followSpeechHighlight({ querySelectorAll: () => [visible.target] });
    assert.equal(visible.scrolls(), 0);
});

test('follows a word outside the viewport and accounts for sticky controls', () => {
    const word = fakeTarget(900, 920);
    const sentence = fakeTarget(180, 200);
    followSpeechHighlight({ querySelectorAll: selector => selector.endsWith('mark') ? [word.target] : [sentence.target] });
    assert.equal(word.scrolls(), 1);
    assert.equal(word.target.style.scrollMarginTop, '160px');
    assert.deepEqual(word.scrollOptions(), { block: 'center', inline: 'nearest', behavior: 'smooth' });
    assert.equal(sentence.scrolls(), 0);
});

test('ignores hidden highlights and avoids counting the PDF player twice', () => {
    const hidden = fakeTarget(900, 920, { hidden: true });
    const visible = fakeTarget(100, 120, { playerInsideHeader: true });
    followSpeechHighlight({ querySelectorAll: selector => selector.endsWith('mark') ? [hidden.target] : [visible.target] });
    assert.equal(hidden.scrolls(), 0);
    assert.equal(visible.scrolls(), 1);
    assert.equal(visible.target.style.scrollMarginTop, '120px');
});

test('respects reduced-motion preferences', () => {
    globalThis.window.matchMedia = () => ({ matches: true });
    const word = fakeTarget(900, 920);
    followSpeechHighlight({ querySelectorAll: () => [word.target] });
    assert.equal(word.scrollOptions().behavior, 'auto');
    delete globalThis.window.matchMedia;
});

test('does not restart a smooth scroll at every word boundary', () => {
    const word = fakeTarget(900, 920);
    const text = { querySelectorAll: () => [word.target] };
    followSpeechHighlight(text);
    followSpeechHighlight(text);
    assert.equal(word.scrolls(), 1);
});

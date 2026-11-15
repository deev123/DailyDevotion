import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/bible/BibleReader.tsx', import.meta.url), 'utf8');
const start = source.indexOf('    const restore = useCallback(');
const effect = source.slice(start, source.indexOf('    useLayoutEffect(', start));
const code = ts.transpileModule(effect + '\nglobalThis.restore = restore;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function harness() {
    const position = { index: 4, verse: '14', offset: 180, version: 111 };
    const frames = new Map();
    let frameId = 0;
    let ready = false;
    let maxScroll = Infinity;
    const window = { scrollY: 0, scrollBy: ({ top }) => { window.scrollY = Math.max(0, Math.min(maxScroll, window.scrollY + top)); } };
    let verse = { getBoundingClientRect: () => ({ top: 2000 - window.scrollY }) };
    const chapter = { querySelectorAll: () => [verse] };
    const context = {
        pending: { current: position }, state: { current: { current: position } },
        restoreFrame: { current: null }, activeRef: { current: true }, canCapture: { current: false },
        document: { fonts: { status: 'loaded' } }, window,
        root: { current: { querySelector: selector => ready && selector.includes('4|111') ? chapter : null } },
        verseSelector: 'verse', verseNumber: () => '14', useCallback: callback => callback,
        requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame: id => frames.delete(id), setRestorationCycle() {},
    };
    vm.runInNewContext(code, context);
    return { context, window, position,
        replaceVerse() {
            verse.getBoundingClientRect = () => ({ top: 0 });
            verse = { getBoundingClientRect: () => ({ top: 2000 - window.scrollY }) };
        }, ready: () => { ready = true; }, limit: value => { maxScroll = value; },
        flush() { while (frames.size) { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(); } } };
}

test('waits for matching text, translation metadata and fonts before releasing the saved position', () => {
    const h = harness();
    h.context.restore();
    assert.equal(h.window.scrollY, 0);
    h.ready(); h.context.document.fonts.status = 'loading'; h.context.restore();
    assert.equal(h.window.scrollY, 0);
    h.context.document.fonts.status = 'loaded'; h.context.restore();
    assert.equal(h.context.pending.current, h.position);
    h.flush();
    assert.equal(h.context.pending.current, null);
    assert.equal(h.window.scrollY, 1820);
});
test('continues restoring when a short page grows after adjacent chapters load', () => {
    const h = harness(); h.ready(); h.limit(500);
    h.context.restore(); h.flush();
    assert.equal(h.window.scrollY, 500);
    h.limit(3000); h.context.restore(); h.flush();
    assert.equal(h.window.scrollY, 1820);
});
test('does not pull the user back after they start scrolling', () => {
    const h = harness(); h.ready(); h.context.restore();
    h.context.canCapture.current = true;
    h.context.pending.current = null;
    h.window.scrollY = 1900;
    h.flush(); h.context.restore();
    assert.equal(h.window.scrollY, 1900);
});

test('reacquires the verse when speech rendering replaces its DOM between frames', () => {
    const h = harness(); h.ready(); h.context.restore();
    h.replaceVerse(); h.flush();
    assert.equal(h.window.scrollY, 1820);
    assert.equal(h.context.pending.current, null);
});

test('defers position restoration while a modal is open and resumes after dismissal', () => {
    const h = harness(); h.ready();
    h.context.document.querySelector = () => ({});
    h.context.restore(); h.flush();
    assert.equal(h.window.scrollY, 0);
    assert.equal(h.context.pending.current, h.position);
    h.context.document.querySelector = () => null;
    h.context.restore(); h.flush();
    assert.equal(h.window.scrollY, 1820);
    assert.equal(h.context.pending.current, null);
});

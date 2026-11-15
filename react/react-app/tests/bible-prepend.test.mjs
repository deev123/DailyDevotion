import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual prepend effect across its placeholder and loaded states.
const source = readFileSync(new URL('../src/features/bible/BibleReader.tsx', import.meta.url), 'utf8');
const effect = source.slice(source.indexOf('    useLayoutEffect(() => {', source.indexOf('// Preserve the visible text')), source.indexOf('    const loadPrevious'));
const code = ts.transpileModule(effect, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function harness() {
    let documentTop = 400;
    let loaded = false;
    let resize;
    let disconnected = false;
    let cleanup;
    const window = { scrollY: 0, scrollBy: ({ top }) => { window.scrollY += top; } };
    const anchor = { getBoundingClientRect: () => ({ top: documentTop - window.scrollY }) };
    const inserted = { querySelector: () => loaded ? {} : null };
    vm.runInNewContext(code, {
        start: 4,
        prependAnchor: { current: { index: 5, top: 200 } },
        activeRef: { current: true },
        root: { current: { querySelector: selector => selector.includes('"5"') ? anchor : inserted } },
        window, document: { querySelector: () => null },
        useLayoutEffect: callback => { cleanup = callback(); },
        ResizeObserver: class {
            constructor(callback) { resize = callback; }
            observe() {}
            disconnect() { disconnected = true; }
        },
    });
    return {
        window, anchor,
        resizeTo(top, ready = false) {
            documentTop = top;
            loaded = ready;
            if (!disconnected) resize();
        },
        disconnected: () => disconnected,
        cleanup: () => cleanup(),
    };
}

test('keeps the existing chapter in place through placeholder and fetched-text growth', () => {
    const h = harness();
    assert.equal(h.anchor.getBoundingClientRect().top, 200);
    h.resizeTo(430);
    assert.equal(h.anchor.getBoundingClientRect().top, 200);
    h.resizeTo(3000, true);
    assert.equal(h.anchor.getBoundingClientRect().top, 200);
    assert.ok(h.disconnected());
});

test('preserves user scrolling during a pending load and stops adjusting once loaded', () => {
    const h = harness();
    h.window.scrollY += 70;
    h.resizeTo(3000, true);
    assert.equal(h.anchor.getBoundingClientRect().top, 130);
    const savedScroll = h.window.scrollY;
    h.resizeTo(3100, true);
    assert.equal(h.window.scrollY, savedScroll);
    h.cleanup();
});

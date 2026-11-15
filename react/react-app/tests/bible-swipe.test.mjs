import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/bible/useBibleChapterSwipe.ts', import.meta.url), 'utf8');
const start = source.indexOf('    useEffect(() => {\n        if (!enabled');
const code = ts.transpileModule(source.slice(start, source.indexOf('    return { bodyRef', start)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

test('animates into a chapter already mounted by infinite scrolling, once only', () => {
    const animations = [];
    let effect;
    const context = {
        enabled: true, direction: 1,
        incomingSwipe: { current: 0 }, incomingConsumed: { current: false },
        swipeBusy: { current: false }, swipeAnimation: { current: null },
        bodyRef: { current: { animate(frames, options) { animations.push({ frames, options }); return {}; } } },
        window: { matchMedia: () => ({ matches: false }) },
        useEffect: callback => { effect = callback; },
    };
    vm.runInNewContext(code, context);
    effect();
    assert.equal(animations.length, 1);
    assert.equal(animations[0].frames[0].transform, 'translateX(35%)');
    effect();
    assert.equal(animations.length, 1);
});

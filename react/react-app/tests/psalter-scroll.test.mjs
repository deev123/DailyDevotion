import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../src/features/psalter/Psalter.tsx', import.meta.url), 'utf8');
const start = source.indexOf('    function select(');
const code = ts.transpileModule(source.slice(start, source.indexOf('    return <section', start)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness(index = 0) {
    let bottom = 500, effect;
    const scrolls = [], saved = [];
    const item = { getBoundingClientRect: () => ({ bottom }) };
    const context = vm.createContext({
        index, references: Array.from({ length: 150 }), psalms: [{}], error: false, id: 'psalter',
        sectionRef: { current: { closest: () => item } }, scrollPositionRef: { current: null },
        setIndex: value => { context.index = value; },
        localStorage: { setItem: (key, value) => saved.push([key, value]) },
        window: { scrollBy: options => scrolls.push(options.top) },
        useLayoutEffect: callback => { effect = callback; },
    });
    vm.runInContext(code, context);
    return { context, scrolls, saved, resize: value => { bottom = value; }, commit: () => effect() };
}

test('advancing keeps the bottom offset with one correction after the new psalm renders', () => {
    const h = harness(); h.context.next();
    assert.equal(h.context.index, 1);
    assert.deepEqual(h.saved, [['psalter_index', '1']]);
    assert.deepEqual(h.scrolls, []);
    h.resize(200); h.commit(); h.commit();
    assert.deepEqual(h.scrolls, [-300]);
});
test('wraps from Psalm 150 to Psalm 1 and handles a taller replacement', () => {
    const h = harness(149); h.context.next(); h.resize(900); h.commit();
    assert.equal(h.context.index, 0);
    assert.deepEqual(h.scrolls, [400]);
});
test('manual selection cancels a pending advance correction', () => {
    const h = harness(); h.context.next(); h.context.select(10); h.resize(200); h.commit();
    assert.deepEqual(h.scrolls, []);
});

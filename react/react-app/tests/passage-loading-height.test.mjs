import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/bible/useStableLoadingHeight.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function harness() {
    let stored, previousDeps, cleanup, height = 0;
    const observers = [];
    const section = { current: { getBoundingClientRect: () => ({ height }) } };
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module, exports: module.exports,
        require: () => ({
            useState: () => [stored, value => { stored = typeof value === 'function' ? value(stored) : value; }],
            useLayoutEffect(callback, deps) {
                if (!previousDeps || deps.some((value, index) => value !== previousDeps[index])) {
                    cleanup?.(); previousDeps = deps; cleanup = callback();
                }
            },
        }),
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe() { this.active = true; }
            disconnect() { this.active = false; }
        },
    });
    return {
        render: (loading, inherited) => module.exports.useStableLoadingHeight(section, loading, inherited),
        resize(value) { height = value; for (const observer of observers) if (observer.active) observer.callback(); },
    };
}
test('retains the loaded height through skeleton changes, then releases it for real content', () => {
    const h = harness();
    h.render(false); h.resize(2400);
    assert.equal(h.render(true), 2400);
    h.resize(350);
    assert.equal(h.render(true), 2400);
    assert.equal(h.render(false), undefined);
    h.resize(600);
    assert.equal(h.render(true), 600);
});
test('hidden tabs cannot overwrite the last visible height with zero', () => {
    const h = harness(); h.render(false); h.resize(1500); h.resize(0);
    assert.equal(h.render(true), 1500);
});
test('new Bible chapter instances inherit the outgoing chapter height until loaded', () => {
    const h = harness();
    assert.equal(h.render(true, 1800), 1800);
    assert.equal(h.render(false, 1800), undefined);
    h.resize(700);
    assert.equal(h.render(true, 1800), 700);
});

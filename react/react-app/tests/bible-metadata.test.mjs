import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../src/features/bible/useBibleMetadata.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function harness() {
    const slots = [], dependencies = [], cleanups = [], effects = [], books = new Map();
    let cursor = 0, detailAttempts = 0;
    const react = {
        useState(initial) {
            const slot = cursor++;
            if (!(slot in slots)) slots[slot] = initial;
            return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
        },
        useCallback: callback => callback,
        useEffect(callback, deps) {
            const slot = cursor++;
            if (!dependencies[slot] || deps.some((value, i) => !Object.is(value, dependencies[slot][i]))) {
                dependencies[slot] = deps;
                effects.push(() => { cleanups[slot]?.(); cleanups[slot] = callback(); });
            }
        },
    };
    const api = {
        fetchVersionDetail: async id => { detailAttempts++; return detailAttempts === 1 ? null : { id, languageTag: 'es' }; },
        fetchBookTitles: id => new Promise(resolve => books.set(id, resolve)),
    };
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, Map, require: name => name === 'react' ? react : { default: api } });
    return {
        render(id) { cursor = 0; const value = module.exports.useBibleMetadata(id); while (effects.length) effects.shift()(); return value; },
        books, attempts: () => detailAttempts,
    };
}

test('late book names for an old translation cannot overwrite names for the current translation', async () => {
    const h = harness();
    h.render(111).loadBookNames();
    h.render(3034).loadBookNames();
    h.books.get(3034)(new Map([['GEN', 'Genesis']])); await Promise.resolve();
    h.books.get(111)(new Map([['GEN', 'Génesis']])); await Promise.resolve();
    assert.equal(h.render(3034).titles.get('GEN'), 'Genesis');
    assert.equal(h.render(111).titles.get('GEN'), 'Génesis');
});
test('failed translation metadata can be retried without reloading the passage', async () => {
    const h = harness(); h.render(111); await Promise.resolve();
    const failed = h.render(111);
    assert.equal(failed.failed, true);
    failed.retry(); h.render(111); await Promise.resolve();
    assert.equal(h.render(111).detail.languageTag, 'es');
    assert.equal(h.attempts(), 2);
});

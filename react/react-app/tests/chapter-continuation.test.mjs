import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/IntegratedSpeechPassage.tsx', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('    async function continueToNextChapter('), source.indexOf('    // produce a localized label'));
const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(index, listElements) {
    const actions = [];
    const context = vm.createContext({ index, listElements,
        saveIndex: value => actions.push(['save', value]),
        setResumePlayer: value => actions.push(['resume', { ...value }]),
        setHtml: value => actions.push(['clear', value]),
        setIndex: value => actions.push(['index', value]),
    });
    vm.runInContext(js, context);
    return { context, actions };
}

test('advances and resumes the next chapter using the original playback generation', async () => {
    const h = harness(1, ['one', 'two', 'three']);
    assert.equal(await h.context.continueToNextChapter(() => true, 42), true);
    assert.deepEqual(h.actions, [
        ['save', 2], ['resume', { open: true, playing: true, generation: 42 }], ['clear', ''], ['index', 2],
    ]);
});

test('stops at the last chapter and ignores invalidated playback', async () => {
    const last = harness(2, ['one', 'two', 'three']);
    assert.equal(await last.context.continueToNextChapter(() => true, 1), false);
    assert.deepEqual(last.actions, []);
    const paused = harness(0, ['one', 'two']);
    assert.equal(await paused.context.continueToNextChapter(() => false, 1), false);
    assert.deepEqual(paused.actions, []);
});

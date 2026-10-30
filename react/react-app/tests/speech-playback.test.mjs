import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the component's actual playback functions with a deterministic speech
// engine, including events that browsers can deliver after cancellation.
const source = readFileSync(new URL('../src/SpeechPassage.tsx', import.meta.url), 'utf8');
const playback = source.slice(source.indexOf('    function pause()'), source.indexOf('    useEffect(() => {\n        if (!autoPlay || !voice)'))
    .replace('const startAutomatically = useEffectEvent(', 'const startAutomatically = (');
const javascript = ts.transpileModule(playback, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function harness() {
    const timers = new Map();
    const spoken = [];
    let timerId = 0;
    const ref = current => ({ current });
    const noop = () => {};
    const voice = { voiceURI: 'chosen', name: 'Chosen voice', lang: 'en-GB' };
    const context = vm.createContext({
        autoPlayConsumed: ref(false), mountGeneration: ref(0), playbackGeneration: 0,
        speechSessionRef: ref(0), watchdogRef: ref(null), nextSpeechRef: ref(null),
        rateChangeRef: ref(null), utteranceRef: ref(null), stopRef: ref(null),
        wordStartRef: ref(null), positionRef: ref(0), stopActiveReader: null,
        supported: true, sentences: [{ text: 'First sentence.' }, { text: 'Second sentence.' }],
        rate: 1.3, voice, language: 'en', onComplete: undefined, onContinueChapter: undefined,
        continueChapterRef: ref(false), autoPlayGeneration: undefined,
        onPlaybackStart: noop, setSelectedVoice: noop, savePreference: noop,
        voiceKey: v => v.voiceURI, setWord: noop, setStatus: noop, setPlayerOpen: noop, setPlayerGeneration: noop, setError: noop,
        setSentenceIndex: noop, savePosition: noop,
        SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
        document: { visibilityState: 'visible' },
        window: {
            speechSynthesis: { cancel: noop, resume: noop, speak: u => spoken.push(u) },
            setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
            clearTimeout: id => timers.delete(id), setInterval: () => ++timerId, clearInterval: noop,
        },
    });
    vm.runInContext(javascript + '\nglobalThis.startAutomatically = startAutomatically;', context);
    return { context, spoken, flush() {
        const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback());
    } };
}

test('duplicate end and late error events advance only once, preserving voice and rate', () => {
    const h = harness(); h.context.play(0); h.flush();
    const first = h.spoken[0];
    first.onend(); first.onend(); first.onerror({ error: 'interrupted' });
    h.flush();
    assert.equal(h.spoken.length, 2);
    assert.equal(h.spoken[1].text, 'Second sentence.');
    assert.equal(h.spoken[1].voice, first.voice);
    assert.equal(h.spoken[1].rate, 1.3);
});

test('a pending automatic start cannot restart manually paused playback', () => {
    const h = harness(); h.context.pause(); h.context.startAutomatically(); h.flush();
    assert.equal(h.spoken.length, 0);
});

test('automatic startup is consumed by manual play', () => {
    const h = harness(); h.context.play(0); h.context.startAutomatically(); h.flush();
    assert.equal(h.spoken.length, 1);
});

test('unavailable selected voice never falls back to browser default', () => {
    const h = harness(); h.context.voice = undefined; h.context.play(0); h.flush();
    assert.equal(h.spoken.length, 0);
});

test('old callbacks cannot queue speech after a chapter handoff', () => {
    const h = harness(); h.context.play(0); h.flush();
    const old = h.spoken[0]; h.context.pause(); h.context.play(1);
    old.onend(); old.onerror({ error: 'canceled' }); h.flush();
    assert.equal(h.spoken.length, 2);
    assert.equal(h.spoken[1].text, 'Second sentence.');
});

test('another reader starting cancels a pending automatic start', () => {
    const h = harness(); h.context.playbackGeneration++; h.context.startAutomatically(); h.flush();
    assert.equal(h.spoken.length, 0);
});

test('starting playback always opens the player', () => {
    const h = harness();
    let open = false;
    h.context.setPlayerOpen = value => { open = value; };
    h.context.play(0);
    assert.equal(open, true);
});

function finishReading(h) {
    h.context.play(0); h.flush();
    h.spoken[0].onend(); h.flush();
    h.spoken[1].onend(); h.flush();
}

test('passage continuation is off until enabled and can be enabled during playback', () => {
    const off = harness();
    let offCalls = 0;
    off.context.onContinueChapter = () => { offCalls++; return Promise.resolve(true); };
    finishReading(off);
    assert.equal(offCalls, 0);

    const on = harness();
    let calls = 0;
    let continuationGeneration;
    on.context.onContinueChapter = (isCurrent, generation) => {
        assert.equal(isCurrent(), true); calls++; continuationGeneration = generation;
        return Promise.resolve(true);
    };
    on.context.play(0); on.flush();
    on.context.continueChapterRef.current = true;
    on.spoken[0].onend(); on.flush();
    on.spoken[1].onend(); on.flush();
    assert.equal(calls, 1);
    assert.equal(continuationGeneration, on.context.playbackGeneration);
});

test('PDF continuation remains enabled independently of the chapter preference', () => {
    const h = harness();
    let calls = 0;
    h.context.onComplete = () => { calls++; return Promise.resolve(true); };
    finishReading(h);
    assert.equal(calls, 1);
});

test('another reader starting during a chapter load prevents automatic playback', () => {
    const h = harness();
    h.context.autoPlayGeneration = 0;
    h.context.mountGeneration.current = 1;
    h.context.playbackGeneration = 1;
    h.context.startAutomatically(); h.flush();
    assert.equal(h.spoken.length, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBibleState, updateHistory, emptyPosition } from '../src/features/bible/readingHistory.ts';
const position = (index, verse = '1') => ({ index, verse, offset: 130, version: 3034 });
test('scrolling replaces the current visit and selecting adds a visit', () => {
    let history = updateHistory([position(0)], position(0, '15'), false);
    assert.deepEqual(history, [position(0, '15')]);
    history = updateHistory(history, position(900), true);
    history = updateHistory(history, position(901, '9'), false);
    assert.deepEqual(history, [position(0, '15'), position(901, '9')]);
});
test('retains the last twenty visits', () => {
    let history = [];
    for (let index = 0; index < 30; index++) history = updateHistory(history, position(index), true);
    assert.equal(history.length, 20);
    assert.equal(history[0].index, 10);
});
test('restores chapter, translation, verse offset and infinite mode', () => {
    const saved = { current: position(900, '16'), history: [position(0), position(900, '16')], infinite: true };
    assert.deepEqual(parseBibleState(JSON.stringify(saved)), saved);
});
test('recovers from malformed storage and rejects invalid positions', () => {
    for (const raw of [null, '{', '{}', JSON.stringify({ current: position(-1) })]) assert.deepEqual(parseBibleState(raw).current, emptyPosition);
    const recovered = parseBibleState(JSON.stringify({ current: position(10), history: [position(5), position(1189), null] }));
    assert.deepEqual(recovered.history, [position(5)]);
});

test('selecting the same verse consecutively updates its saved details without adding a duplicate', () => {
    const first = position(900, '16');
    const latest = { ...first, offset: 175, version: 111 };
    const history = updateHistory([first], latest, true);
    assert.deepEqual(history, [latest]);
    assert.deepEqual(updateHistory(history, latest, true), [latest]);
});
test('keeps repeated references when another verse separates the visits', () => {
    const a = position(900, '16');
    const b = position(900, '17');
    let history = updateHistory([a], b, true);
    history = updateHistory(history, a, true);
    assert.deepEqual(history, [a, b, a]);
});
test('scrolling also collapses consecutive duplicates without mutating existing history', () => {
    const a = position(900, '16');
    const original = [a, position(901)];
    const latest = { ...a, offset: 150 };
    assert.deepEqual(updateHistory(original, latest, false), [latest]);
    assert.deepEqual(original, [a, position(901)]);
});
test('cleans existing adjacent duplicates when restoring saved history', () => {
    const a = position(900, '16');
    const latest = { ...a, offset: 180 };
    const b = position(901);
    const restored = parseBibleState(JSON.stringify({ current: a, history: [a, latest, b, a, a], infinite: false }));
    assert.deepEqual(restored.history, [latest, b, a]);
});

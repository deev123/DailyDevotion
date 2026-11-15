import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceLabels } from '../src/features/bible/referenceLabels.ts';

test('abbreviates the book while keeping chapter and verse intact', () => {
    assert.deepEqual(referenceLabels('Samuel 11:14'), ['Samuel 11:14', 'Sam 11:14']);
    assert.equal(referenceLabels('samuel 11:14').at(-1), 'Sam 11:14');
});
test('retains numbered books and verse ranges at the smallest size', () => {
    assert.equal(referenceLabels('1 Samuel 11:14–16').at(-1), '1 Sam 11:14–16');
    assert.equal(referenceLabels('2 Samuel 11:14').at(-1), '2 Sam 11:14');
    assert.equal(referenceLabels('II Samuel 11:14').at(-1), 'II Sam 11:14');
});
test('supports chapter references, localized names and numeric prefixes', () => {
    assert.ok(referenceLabels('Song of Solomon 8').includes('Song 8'));
    assert.equal(referenceLabels('Ésaïe 11:14').at(-1), 'Ésa 11:14');
    assert.equal(referenceLabels('١ صموئيل ١١:١٤').at(-1), '١ صمو ١١:١٤');
});
test('leaves non-reference labels intact and avoids duplicate alternatives', () => {
    assert.deepEqual(referenceLabels('Select passage'), ['Select passage']);
    const choices = referenceLabels('Gen 1');
    assert.equal(new Set(choices).size, choices.length);
});

test('never reduces Samuel to a single letter or removes reference spacing', () => {
    assert.deepEqual(referenceLabels('1 Samuel 14'), ['1 Samuel 14', '1 Sam 14']);
});

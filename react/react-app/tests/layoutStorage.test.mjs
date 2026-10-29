import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStoredLayout, migrateLegacyPassageIndices } from '../src/layoutStorage.ts';

function memoryStorage(entries = {}) {
    const values = new Map(Object.entries(entries));
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
    };
}

test('migrates all known passage readers while retaining IDs and lists', () => {
    const result = parseStoredLayout(JSON.stringify([
        { type: 'passage', id: 'psalm', list: 'Psalms.txt' },
        { type: 'passage', id: 'bible', list: 'Bible_Chapters.txt' },
        { type: 'speechPassage', id: 'speech', list: 'Bible_Chapters.txt' },
        { type: 'integratedSpeechPassage', id: 'test', list: 'Bible_Chapters.txt' },
        { type: 'passage2', id: 'current', list: 'Bible_Chapters.txt' },
    ]));
    assert.deepEqual(result.components.map(c => [c.type, c.id, c.list]), [
        ['passage2', 'psalm', 'Psalms.txt'], ['passage2', 'bible', 'Bible_Chapters.txt'],
        ['passage2', 'speech', 'Bible_Chapters.txt'], ['passage2', 'test', 'Bible_Chapters.txt'],
        ['passage2', 'current', 'Bible_Chapters.txt'],
    ]);
    assert.deepEqual(result.legacyPassageIds, ['psalm', 'bible']);
    assert.ok(result.changed);
    assert.ok(result.migratedEntries.every(c => c.type === 'passage2'));
});

test('preserves unsupported and malformed entries without displaying them', () => {
    const unknown = { type: 'futureReader', id: 'future', data: 'keep' };
    const entries = [null, unknown, { type: 'passage', id: 'broken' }, { type: 'notebox', id: 'notes' }];
    const result = parseStoredLayout(JSON.stringify(entries));
    assert.deepEqual(result.components, [{ type: 'notebox', id: 'notes' }]);
    assert.deepEqual(result.hidden, entries.slice(0, 3));
    assert.deepEqual(result.migratedEntries, entries);
    assert.equal(parseStoredLayout('{'), null);
    assert.equal(parseStoredLayout('{}'), null);
    assert.deepEqual(parseStoredLayout('[]').components, []);
});

test('keeps old embedded video lists and supplies the default for missing lists', () => {
    const videos = [{ title: 'Genesis', videoId: 'abc' }, { title: 'invalid' }];
    const result = parseStoredLayout(JSON.stringify([
        { type: 'videoPlaylist', id: 'embedded', list: videos },
        { type: 'videoPlaylist', id: 'default' },
    ]));
    assert.deepEqual(result.components, [
        { type: 'videoPlaylist', id: 'embedded', list: [videos[0]] },
        { type: 'videoPlaylist', id: 'default', list: 'NIV_Audio_Bible.json' },
    ]);
    assert.ok(result.changed);
});

test('migrates bare saved indices without overwriting newer values', () => {
    const storage = memoryStorage({ psalm: '42', bible: '7', bible_index: '12', broken: 'invalid' });
    migrateLegacyPassageIndices(storage, ['psalm', 'bible', 'broken']);
    assert.equal(storage.getItem('psalm_index'), '42');
    assert.equal(storage.getItem('psalm'), null);
    assert.equal(storage.getItem('bible_index'), '12');
    assert.equal(storage.getItem('bible'), null);
    assert.equal(storage.getItem('broken'), 'invalid');
});

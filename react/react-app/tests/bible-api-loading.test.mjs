import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { RequestCache } from '../src/features/bible/apiCache.ts';
const source = readFileSync(new URL('../src/features/bible/YouVersionAPI.ts', import.meta.url), 'utf8')
    .replace('import.meta.env.VITE_YOUVERSION_APP_KEY ?? ""', '"test-key"');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function harness(respond, stored = new Map()) {
    const calls = [];
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module, exports: module.exports,
        require: () => ({ RequestCache }),
        fetch: async (url, options) => { calls.push(url); assert.ok(options.signal instanceof AbortSignal); return respond(url); },
        AbortSignal, Error, Intl, Date, Map,
        localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    });
    return { api: module.exports.default, calls, stored };
}
const json = data => new Response(JSON.stringify(data), { status: 200 });

test('saved chapters load without catalogue, languages or book-name requests, sharing identical requests', async () => {
    const h = harness(() => json({ content: '<p>Verse text</p>', reference: 'Genesis 1' }));
    const results = await Promise.all([h.api.fetchChapterHtml(111, 'GEN.1'), h.api.fetchChapterHtml(111, 'GEN.1')]);
    assert.ok(results.every(result => result.ok));
    await h.api.fetchChapterHtml(111, 'GEN.1');
    assert.equal(h.calls.length, 1);
    assert.ok(h.calls[0].includes('/bibles/111/passages/GEN.1?'));
    await h.api.fetchChapterHtml(3034, 'GEN.1');
    assert.equal(h.calls.length, 2, 'different translations have separate cached text');
});
test('transient failures and timeouts remain retryable', async () => {
    let attempts = 0;
    const h = harness(() => ++attempts === 1 ? new Response('', { status: 500 }) : json({ content: '<p>Recovered</p>' }));
    assert.equal((await h.api.fetchChapterHtml(111, 'GEN.1')).ok, false);
    assert.equal((await h.api.fetchChapterHtml(111, 'GEN.1')).ok, true);
    assert.equal(h.calls.length, 2);
    const timeout = harness(() => { throw new DOMException('Timed out', 'TimeoutError'); });
    assert.match((await timeout.api.fetchChapterHtml(111, 'GEN.1')).error, /too long/);
});
test('metadata is shared and only compact book names are persisted across sessions', async () => {
    const stored = new Map();
    const h = harness(url => url.endsWith('/books') ? json({ data: [{ id: 'GEN', title: 'Genesis', chapters: [{ verses: [1, 2, 3] }] }] }) : json({ id: 111, abbreviation: 'NIV', title: 'NIV', language_tag: 'en', copyright: 'Notice' }), stored);
    await Promise.all([h.api.fetchVersionDetail(111), h.api.fetchVersionDetail(111)]);
    await Promise.all([h.api.fetchBookTitles(111), h.api.fetchBookTitles(111)]);
    assert.equal(h.calls.length, 2);
    assert.ok(![...stored.values()][0].includes('verses'));
    const nextSession = harness(() => { throw Error('Should use persisted names'); }, stored);
    assert.equal((await nextSession.api.fetchBookTitles(111)).get('GEN'), 'Genesis');
    assert.equal(nextSession.calls.length, 0);
});
test('compact translation browsing is one request and language names are independently lazy', async () => {
    const h = harness(url => url.includes('/languages') ? json({ data: [{ id: 'en', display_names: { en: 'English' } }] }) : json({ data: [{ id: 111, localized_title: 'NIV', language_tag: 'en' }] }));
    await h.api.fetchVersionIndex(); await h.api.fetchVersionIndex();
    assert.equal(h.calls.length, 1);
    assert.ok(h.calls[0].includes('page_size=*'));
    await h.api.fetchLanguageNames(); await h.api.fetchLanguageNames();
    assert.equal(h.calls.length, 2);
});
test('first-time readers request a small English catalogue, never the all-language catalogue', async () => {
    const h = harness(() => json({ data: [{ id: 3034, abbreviation: 'BSB', title: 'Berean Standard Bible', language_tag: 'en' }] }));
    const defaults = await Promise.all([h.api.fetchDefaultVersion(), h.api.fetchDefaultVersion()]);
    assert.deepEqual(defaults, [3034, 3034]);
    assert.equal(h.calls.length, 1);
    assert.ok(h.calls[0].includes('language_ranges[]=en'));
});

test('saved translation IDs are restored without any API request, with malformed values rejected', () => {
    const h = harness(() => { throw Error('No request expected'); });
    for (const value of ['111', '"111"']) {
        h.stored.set('saved', value);
        assert.equal(h.api.readSavedVersion('saved'), 111);
    }
    for (const value of ['true', 'null', '-1', '"oops"', '{']) {
        h.stored.set('saved', value);
        assert.equal(h.api.readSavedVersion('saved'), null);
    }
    assert.equal(h.calls.length, 0);
});

test('invalid translation details are not cached, allowing a later successful retry', async () => {
    let attempts = 0;
    const h = harness(() => json(++attempts === 1 ? { data: [] } : { id: 111, abbreviation: 'NIV', title: 'NIV', language_tag: 'en' }));
    assert.equal(await h.api.fetchVersionDetail(111), null);
    assert.equal((await h.api.fetchVersionDetail(111)).languageTag, 'en');
    assert.equal(h.calls.length, 2);
});
test('empty translation indexes are retryable and do not poison the catalogue cache', async () => {
    let attempts = 0;
    const h = harness(() => json({ data: ++attempts === 1 ? [] : [{ id: 111, localized_title: '', language_tag: 'en' }] }));
    await assert.rejects(h.api.fetchVersionIndex());
    const versions = await h.api.fetchVersionIndex();
    assert.equal(versions[0].title, 'Bible 111');
    assert.equal(h.calls.length, 2);
});
test('legacy language metadata is preserved for existing catalogue consumers', async () => {
    const h = harness(() => json({ data: [{ id: 111, abbreviation: 'NIV', title: 'NIV', language: { iso_639_1: 'es' } }] }));
    const versions = await h.api.fetchVersions();
    assert.equal(versions[0].languageTag, 'es');
    assert.equal(versions[0].languageGroup, 'es');
});

test('metadata without a language cannot enable speech using an assumed English language', async () => {
    const h = harness(() => json({ id: 111, abbreviation: 'NIV', title: 'NIV' }));
    assert.equal(await h.api.fetchVersionDetail(111), null);
});

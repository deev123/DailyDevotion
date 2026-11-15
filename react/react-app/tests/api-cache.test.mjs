import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestCache } from '../src/features/bible/apiCache.ts';

test('shares pending requests and reuses successful responses', async () => {
    const cache = new RequestCache(2, 1000);
    let calls = 0;
    const load = async () => { calls++; return 'chapter'; };
    const first = cache.get('one', load);
    assert.equal(cache.get('one', load), first);
    assert.equal(await first, 'chapter');
    assert.equal(await cache.get('one', load), 'chapter');
    assert.equal(calls, 1);
});
test('failures can be retried, and concurrent failures still share one request', async () => {
    const cache = new RequestCache(2, 1000);
    let calls = 0;
    const first = cache.get('one', async () => { calls++; throw Error('offline'); });
    assert.equal(cache.get('one', async () => 'unused'), first);
    await assert.rejects(first, /offline/);
    assert.equal(await cache.get('one', async () => { calls++; return 'recovered'; }), 'recovered');
    assert.equal(calls, 2);
});
test('evicts the least recently used result and expires old results', async () => {
    const originalNow = Date.now;
    let time = 0;
    Date.now = () => time;
    try {
        const cache = new RequestCache(2, 100);
        await cache.get('a', async () => 'a');
        await cache.get('b', async () => 'b');
        cache.peek('a');
        await cache.get('c', async () => 'c');
        assert.equal(cache.peek('b'), undefined);
        assert.equal(cache.peek('a'), 'a');
        time = 101;
        assert.equal(cache.peek('a'), undefined);
    } finally { Date.now = originalNow; }
});

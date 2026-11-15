/** Share pending requests; retain successful results only, with bounded memory. */
export class RequestCache<T> {
    private values = new Map<string, { value: T; expires: number }>();
    private pending = new Map<string, Promise<T>>();
    private limit: number;
    private ttl: number;
    constructor(limit: number, ttl: number) { this.limit = limit; this.ttl = ttl; }
    peek(key: string): T | undefined {
        const entry = this.values.get(key);
        if (!entry) return undefined;
        if (entry.expires <= Date.now()) { this.values.delete(key); return undefined; }
        this.values.delete(key); this.values.set(key, entry);
        return entry.value;
    }
    get(key: string, load: () => Promise<T>): Promise<T> {
        const cached = this.peek(key);
        if (cached !== undefined) return Promise.resolve(cached);
        const pending = this.pending.get(key);
        if (pending) return pending;
        const request = Promise.resolve().then(load).then(value => {
            this.values.set(key, { value, expires: Date.now() + this.ttl });
            while (this.values.size > this.limit) this.values.delete(this.values.keys().next().value!);
            return value;
        }).finally(() => { this.pending.delete(key); });
        this.pending.set(key, request);
        return request;
    }
}

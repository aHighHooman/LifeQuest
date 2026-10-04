// In-memory Workers KV for tests: get (text or json), put with expiry,
// delete, and prefix listing with cursors.
export const createMemoryKv = (now = () => Date.now()) => {
    const entries = new Map();

    const live = (key) => {
        const entry = entries.get(key);
        if (!entry) return null;
        if (entry.expiresAt && entry.expiresAt <= now()) {
            entries.delete(key);
            return null;
        }
        return entry;
    };

    return {
        entries,
        async get(key, options) {
            const entry = live(key);
            if (!entry) return null;
            const type = typeof options === 'string' ? options : options?.type;
            return type === 'json' ? JSON.parse(entry.value) : entry.value;
        },
        async put(key, value, options = {}) {
            const ttl = options.expirationTtl;
            const expiresAt = ttl ? now() + ttl * 1000 : options.expiration ? options.expiration * 1000 : null;
            entries.set(key, { value: `${value}`, expiresAt, metadata: options.metadata ?? null });
        },
        async delete(key) {
            entries.delete(key);
        },
        async list({ prefix = '', limit = 1000, cursor } = {}) {
            const keys = [...entries.keys()].filter((key) => key.startsWith(prefix) && live(key)).sort();
            const start = cursor ? Number(cursor) : 0;
            const page = keys.slice(start, start + limit);
            const complete = start + limit >= keys.length;
            return {
                keys: page.map((name) => ({
                    name,
                    expiration: entries.get(name).expiresAt ? Math.floor(entries.get(name).expiresAt / 1000) : undefined,
                    metadata: entries.get(name).metadata ?? undefined
                })),
                list_complete: complete,
                ...(complete ? {} : { cursor: `${start + limit}` })
            };
        }
    };
};

// A named object keeps its storage across eviction. blockConcurrencyWhile
// queues callbacks; storage calls alone deliberately do not serialize tests.
export const createMemoryDurableObjectNamespace = (ObjectClass, env) => {
    const states = new Map();
    const instances = new Map();
    const stateFor = (id) => {
        if (!states.has(id)) {
            const values = new Map();
            let pending = Promise.resolve();
            states.set(id, {
                storage: {
                    async get(key) { return structuredClone(values.get(key)); },
                    async put(key, value) { values.set(key, structuredClone(value)); }
                },
                blockConcurrencyWhile(callback) {
                    const result = pending.then(callback);
                    pending = result.catch(() => {});
                    return result;
                }
            });
        }
        return states.get(id);
    };
    return {
        idFromName: (name) => name,
        get(id) {
            if (!instances.has(id)) instances.set(id, new ObjectClass(stateFor(id), env));
            return instances.get(id);
        },
        evict(id) { instances.delete(id); }
    };
};

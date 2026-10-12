import { afterEach, describe, expect, it, vi } from 'vitest';
import { OwnerSignInLimiter } from './ownerSignInLimiter.js';
import { createMemoryDurableObjectNamespace } from '../test-support/memoryDurableObject.js';

const PASSPHRASE = 'correct horse battery staple';
const makeLimiter = () => {
    const env = { LIFEQUEST_OWNER_PASSPHRASE: PASSPHRASE };
    const namespace = createMemoryDurableObjectNamespace(OwnerSignInLimiter, env);
    return { env, namespace, limiter: namespace.get(namespace.idFromName('owner')) };
};

afterEach(() => vi.restoreAllMocks());

describe('owner sign-in limiter', () => {
    it('keeps the lock after eviction and unlocks exactly when the failure window expires', async () => {
        const start = new Date('2026-10-12T12:00:00Z').getTime();
        const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
        const { namespace, limiter } = makeLimiter();
        for (let attempt = 0; attempt < 10; attempt += 1) {
            clock.mockReturnValue(start + attempt * 1000);
            expect(await limiter.verifyPassphrase(`guess-${attempt}`)).toEqual({ status: 'incorrect' });
        }
        expect(await limiter.verifyPassphrase(PASSPHRASE)).toEqual({ status: 'locked', retryAfterSeconds: 891 });
        namespace.evict('owner');
        const restarted = namespace.get('owner');
        clock.mockReturnValue(start + 899999);
        expect(await restarted.verifyPassphrase(PASSPHRASE)).toEqual({ status: 'locked', retryAfterSeconds: 1 });
        clock.mockReturnValue(start + 900000);
        expect(await restarted.verifyPassphrase(PASSPHRASE)).toEqual({ status: 'allowed' });
        expect(await restarted.verifyPassphrase('another guess')).toEqual({ status: 'incorrect' });
        expect(await restarted.verifyPassphrase(PASSPHRASE)).toEqual({ status: 'allowed' });
    });

    it('counts incorrect attempts only, preserving earlier failures across successful checks', async () => {
        const { limiter } = makeLimiter();
        const successes = await Promise.all(Array.from({ length: 25 }, () => limiter.verifyPassphrase(PASSPHRASE)));
        expect(successes.every((result) => result.status === 'allowed')).toBe(true);
        for (let attempt = 0; attempt < 9; attempt += 1) await limiter.verifyPassphrase(`guess-${attempt}`);
        expect(await limiter.verifyPassphrase(PASSPHRASE)).toEqual({ status: 'allowed' });
        expect(await limiter.verifyPassphrase('tenth guess')).toEqual({ status: 'incorrect' });
        expect((await limiter.verifyPassphrase(PASSPHRASE)).status).toBe('locked');
    });

    it('fails closed if the object has no strong owner passphrase', async () => {
        const { env, limiter } = makeLimiter();
        env.LIFEQUEST_OWNER_PASSPHRASE = 'short';
        expect(await limiter.verifyPassphrase('short')).toEqual({ status: 'unconfigured' });
    });
});

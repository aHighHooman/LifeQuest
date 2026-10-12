import { DurableObject } from 'cloudflare:workers';
import { secretsMatch } from './oauth.js';

export const MIN_PASSPHRASE_LENGTH = 16;
const FAILURE_KEY = 'failures';
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export const getOwnerPassphrase = (env) => {
    const passphrase = env.LIFEQUEST_OWNER_PASSPHRASE;
    return typeof passphrase === 'string' && passphrase.length >= MIN_PASSPHRASE_LENGTH ? passphrase : null;
};

// Each client address has a named object. Keep the limit check,
// passphrase comparison, and durable counter update in one serialized operation.
// Store only counts and expiry times, never passphrases or guesses.
export class OwnerSignInLimiter extends DurableObject {
    async verifyPassphrase(candidate) {
        return this.ctx.blockConcurrencyWhile(async () => {
            const expected = getOwnerPassphrase(this.env);
            if (!expected) return { status: 'unconfigured' };
            const now = Date.now();
            const stored = await this.ctx.storage.get(FAILURE_KEY);
            const failures = stored?.expiresAt > now ? stored.count : 0;
            if (failures >= MAX_FAILURES) {
                return { status: 'locked', retryAfterSeconds: Math.ceil((stored.expiresAt - now) / 1000) };
            }
            if (await secretsMatch(candidate, expected)) return { status: 'allowed' };
            await this.ctx.storage.put(FAILURE_KEY, {
                count: failures + 1, expiresAt: failures ? stored.expiresAt : now + FAILURE_WINDOW_MS
            });
            return { status: 'incorrect' };
        });
    }
}

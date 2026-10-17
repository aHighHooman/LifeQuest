import { describe, expect, it } from 'vitest';
import { createMemoryKv } from '../test-support/memoryKv.js';
import worker from './index.js';

const CTX = { waitUntil() {}, passThroughOnException() {} };
const env = (extra = {}) => ({ OAUTH_KV: createMemoryKv(), ...extra });

describe('LifeQuest Worker routing', () => {
    it('serves a public health response', async () => {
        const response = await worker.fetch(new Request('https://worker.example/health'), env(), CTX);
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            service: 'lifequest-action-api'
        });
    });

    it('serves a public privacy policy for the assistant connector', async () => {
        const response = await worker.fetch(new Request('https://worker.example/privacy'), env(), CTX);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');
        const text = await response.text();
        expect(text).toContain('LifeQuest Companion Privacy Policy');
        expect(text).toContain('Model Context Protocol');
    });

    it('no longer serves the retired Custom GPT routes', async () => {
        for (const path of ['/openapi.json', '/v1/today', '/v1/quests/quest-1/complete']) {
            const response = await worker.fetch(new Request(`https://worker.example${path}`, {
                method: path.includes('complete') ? 'POST' : 'GET',
                headers: { authorization: 'Bearer correct' }
            }), env({ LIFEQUEST_ACTION_TOKEN: 'correct' }), CTX);
            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toMatchObject({
                ok: false,
                error: { code: 'route_not_found' }
            });
        }
    });
});

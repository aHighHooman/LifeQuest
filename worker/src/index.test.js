import { describe, expect, it } from 'vitest';
import worker from './index.js';

describe('LifeQuest Action Worker routing', () => {
    it('serves a public health response', async () => {
        const response = await worker.fetch(new Request('https://worker.example/health'), {});
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            service: 'lifequest-action-api'
        });
    });

    it('serves a valid public OpenAPI document without response metadata', async () => {
        const response = await worker.fetch(new Request('https://worker.example/openapi.json'), {});
        const document = await response.json();
        expect(document.openapi).toBe('3.1.0');
        expect(document.servers[0].url).toBe('https://worker.example');
        expect(document.requestId).toBeUndefined();
    });

    it('serves a public privacy policy for the Custom GPT Action', async () => {
        const response = await worker.fetch(new Request('https://worker.example/privacy'), {});
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');
        await expect(response.text()).resolves.toContain('LifeQuest Companion Privacy Policy');
    });

    it('rejects API routes before making Firebase requests when the Action token is absent', async () => {
        const response = await worker.fetch(new Request('https://worker.example/v1/today'), {});
        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({
            ok: false,
            error: { code: 'configuration_error' }
        });
    });

    it('rejects invalid bearer tokens before making Firebase requests', async () => {
        const response = await worker.fetch(new Request('https://worker.example/v1/today', {
            headers: { authorization: 'Bearer wrong' }
        }), {
            LIFEQUEST_ACTION_TOKEN: 'correct'
        });
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({
            ok: false,
            error: { code: 'unauthorized' }
        });
    });
});

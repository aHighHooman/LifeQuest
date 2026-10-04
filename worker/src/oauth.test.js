import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKv } from '../test-support/memoryKv.js';
import worker from './index.js';

const store = vi.hoisted(() => ({ snapshot: null }));

vi.mock('./snapshotStore.js', () => ({
    loadSnapshot: async () => ({ snapshot: structuredClone(store.snapshot), manifest: {}, manifestUpdateTime: 't' }),
    saveSnapshot: async (_env, _loaded, snapshot) => {
        store.snapshot = structuredClone(snapshot);
        return { revisionId: 'revision' };
    }
}));

const ORIGIN = 'https://lifequest.example';
const REDIRECT_URI = 'https://client.example/callback';
const PASSPHRASE = 'correct horse battery staple';
const CTX = { waitUntil() {}, passThroughOnException() {} };

let env;

const call = (path, init = {}) => worker.fetch(new Request(`${ORIGIN}${path}`, init), env, CTX);

const base64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const pkce = async () => {
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    return { verifier, challenge: base64Url(digest) };
};

const register = async (clientName = 'Test Assistant') => {
    const response = await call('/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            client_name: clientName,
            redirect_uris: [REDIRECT_URI],
            token_endpoint_auth_method: 'none',
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code']
        })
    });
    expect(response.status).toBe(201);
    return (await response.json()).client_id;
};

// Opens the consent page and returns what a browser would keep from it.
const openConsent = async (clientId, challenge) => {
    const query = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        scope: 'lifequest offline_access',
        state: 'state-123',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        resource: `${ORIGIN}/mcp`
    });
    const response = await call(`/authorize?${query}`);
    const html = await response.text();
    const cookie = response.headers.getSetCookie().map((entry) => entry.split(';')[0]).join('; ');
    const handle = html.match(/name="handle" value="([^"]+)"/)?.[1];
    const scopes = [...html.matchAll(/name="scope" value="([^"]+)"/g)].map((match) => match[1]);
    return { response, html, cookie, handle, scopes, query };
};

const submitConsent = (consent, fields) => {
    const form = new URLSearchParams({ handle: consent.handle, ...fields });
    consent.scopes.forEach((scope) => form.append('scope', scope));
    return call(`/authorize?${consent.query}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: consent.cookie },
        body: form
    });
};

const exchangeCode = async (clientId, code, verifier) => call('/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
        resource: `${ORIGIN}/mcp`
    })
});

const signIn = async () => {
    const clientId = await register();
    const { verifier, challenge } = await pkce();
    const consent = await openConsent(clientId, challenge);
    const approved = await submitConsent(consent, { decision: 'approve', passphrase: PASSPHRASE });
    const location = new URL(approved.headers.get('location'));
    const tokens = await (await exchangeCode(clientId, location.searchParams.get('code'), verifier)).json();
    return { clientId, tokens };
};

const mcp = (token, method, params = {}) => call('/mcp', {
    method: 'POST',
    headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
});

beforeEach(() => {
    env = {
        OAUTH_KV: createMemoryKv(),
        LIFEQUEST_OWNER_PASSPHRASE: PASSPHRASE,
        LIFEQUEST_ACTION_TOKEN: 'static-action-token',
        LIFEQUEST_TIME_ZONE: 'UTC'
    };
    store.snapshot = {
        formatVersion: 4,
        currencyUnitVersion: 2,
        stats: { level: 2, xp: 10, maxXp: 200, gold: 3 },
        settings: {},
        quests: [],
        habits: [],
        calories: { target: 2000, history: [] },
        coinHistory: [],
        budget: { earnedRewards: 0, goldToUsdRatio: 1 }
    };
});

afterEach(() => vi.restoreAllMocks());

describe('OAuth discovery', () => {
    it('publishes protected resource and authorization server metadata', async () => {
        const resource = await (await call('/.well-known/oauth-protected-resource/mcp')).json();
        expect(resource).toMatchObject({
            resource: `${ORIGIN}/mcp`,
            authorization_servers: [ORIGIN],
            scopes_supported: ['lifequest']
        });

        const server = await (await call('/.well-known/oauth-authorization-server')).json();
        expect(server).toMatchObject({
            issuer: ORIGIN,
            authorization_endpoint: `${ORIGIN}/authorize`,
            token_endpoint: `${ORIGIN}/token`,
            registration_endpoint: `${ORIGIN}/register`
        });
        expect(server.code_challenge_methods_supported).toContain('S256');
    });
});

describe('OAuth sign-in', () => {
    it('issues a token that works on /mcp after the owner approves with the passphrase', async () => {
        const clientId = await register();
        const { verifier, challenge } = await pkce();
        const consent = await openConsent(clientId, challenge);

        expect(consent.response.status).toBe(200);
        expect(consent.html).toContain('Test Assistant');
        expect(consent.html).toContain('client.example');
        expect(consent.html).toContain('not verified');
        expect(consent.handle).toBeTruthy();

        const approved = await submitConsent(consent, { decision: 'approve', passphrase: PASSPHRASE });
        expect(approved.status).toBe(302);
        const location = new URL(approved.headers.get('location'));
        expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URI);
        expect(location.searchParams.get('state')).toBe('state-123');

        const tokenResponse = await exchangeCode(clientId, location.searchParams.get('code'), verifier);
        expect(tokenResponse.status).toBe(200);
        const tokens = await tokenResponse.json();
        expect(tokens.access_token).toBeTruthy();
        expect(tokens.refresh_token).toBeTruthy();
        expect(tokens.scope).toContain('lifequest');

        const tools = await (await mcp(tokens.access_token, 'tools/list')).json();
        expect(tools.result.tools.map((tool) => tool.name)).toContain('get_today');

        const today = await (await mcp(tokens.access_token, 'tools/call', { name: 'get_today', arguments: {} })).json();
        expect(today.result.structuredContent.dashboard).toMatchObject({ coinsOnHand: 3, level: 2 });
    });

    it('refreshes the access token', async () => {
        const { clientId, tokens } = await signIn();
        const refreshed = await call('/token', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokens.refresh_token,
                client_id: clientId,
                resource: `${ORIGIN}/mcp`
            })
        });
        expect(refreshed.status).toBe(200);
        const next = await refreshed.json();
        expect(next.access_token).not.toBe(tokens.access_token);
        expect((await mcp(next.access_token, 'ping')).status).toBe(200);
    });

    it('rejects a wrong passphrase without issuing a code, and the page can be retried', async () => {
        vi.spyOn(globalThis, 'setTimeout').mockImplementation((resolve) => {
            resolve();
            return 0;
        });
        const clientId = await register();
        const { challenge } = await pkce();
        const consent = await openConsent(clientId, challenge);

        const wrong = await submitConsent(consent, { decision: 'approve', passphrase: 'not the passphrase' });
        expect(wrong.status).toBe(401);
        expect(wrong.headers.get('location')).toBeNull();

        const retry = await submitConsent(consent, { decision: 'approve', passphrase: PASSPHRASE });
        expect(retry.status).toBe(302);
        expect(new URL(retry.headers.get('location')).searchParams.get('code')).toBeTruthy();
    });

    it('locks sign-in after repeated wrong passphrases', async () => {
        vi.spyOn(globalThis, 'setTimeout').mockImplementation((resolve) => {
            resolve();
            return 0;
        });
        const clientId = await register();
        const { challenge } = await pkce();
        const consent = await openConsent(clientId, challenge);
        for (let attempt = 0; attempt < 10; attempt += 1) {
            expect((await submitConsent(consent, { decision: 'approve', passphrase: `guess-${attempt}` })).status).toBe(401);
        }
        const locked = await submitConsent(consent, { decision: 'approve', passphrase: PASSPHRASE });
        expect(locked.status).toBe(429);
    });

    it('returns access_denied to the client when the owner denies', async () => {
        const clientId = await register();
        const { challenge } = await pkce();
        const consent = await openConsent(clientId, challenge);
        const denied = await submitConsent(consent, { decision: 'deny' });
        expect(denied.status).toBe(302);
        const location = new URL(denied.headers.get('location'));
        expect(location.searchParams.get('error')).toBe('access_denied');
        expect(location.searchParams.get('state')).toBe('state-123');
    });

    it('refuses approval while no strong owner passphrase is configured', async () => {
        env.LIFEQUEST_OWNER_PASSPHRASE = 'short';
        const clientId = await register();
        const { challenge } = await pkce();
        const consent = await openConsent(clientId, challenge);
        const response = await submitConsent(consent, { decision: 'approve', passphrase: 'short' });
        expect(response.status).toBe(500);
        expect(response.headers.get('location')).toBeNull();
    });

    it('does not let a consent form be replayed after it was used', async () => {
        const clientId = await register();
        const { challenge } = await pkce();
        const consent = await openConsent(clientId, challenge);
        expect((await submitConsent(consent, { decision: 'approve', passphrase: PASSPHRASE })).status).toBe(302);
        const replay = await submitConsent(consent, { decision: 'approve', passphrase: PASSPHRASE });
        expect(replay.status).toBe(400);
        expect(replay.headers.get('location')).toBeNull();
    });

    it('escapes a self-registered client name and refuses framing', async () => {
        const clientId = await register('<script>alert(1)</script>');
        const { challenge } = await pkce();
        const consent = await openConsent(clientId, challenge);
        expect(consent.html).not.toContain('<script>alert(1)</script>');
        expect(consent.html).toContain('&#60;script&#62;');
        expect(consent.response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    });

    it('refuses an unregistered redirect URI without redirecting to it', async () => {
        const clientId = await register();
        const { challenge } = await pkce();
        const query = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: 'https://attacker.example/steal',
            state: 's',
            code_challenge: challenge,
            code_challenge_method: 'S256'
        });
        const response = await call(`/authorize?${query}`);
        expect(response.status).toBe(400);
        expect(response.headers.get('location')).toBeNull();
    });
});

describe('static action token', () => {
    it('still works on /mcp alongside OAuth', async () => {
        expect((await mcp('static-action-token', 'ping')).status).toBe(200);
        expect((await mcp('static-action-token-wrong', 'ping')).status).toBe(401);
    });
});

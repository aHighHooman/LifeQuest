import { HttpError, assertHttp } from './errors.js';
import { createOpenApiDocument } from './openapi.js';
import { loadSnapshot, saveSnapshot } from './snapshotStore.js';
import {
    activateProtocol,
    completeProtocol,
    completeQuest,
    createProtocol,
    createQuest,
    deactivateProtocol,
    discardQuest,
    getRequestClock,
    prepareSnapshot,
    restoreQuest,
    setQuestToday,
    skipProtocol,
    touchSnapshot,
    undoQuest
} from './stateEngine.js';
import {
    dashboardView,
    listProtocolView,
    listQuestView,
    protocolView,
    questView
} from './views.js';

const MAX_ACTION_BODY_BYTES = 64 * 1024;
const PRIVACY_POLICY = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LifeQuest Companion Privacy Policy</title>
  <style>
    body { margin: 0 auto; max-width: 48rem; padding: 3rem 1.25rem; font: 16px/1.6 system-ui, sans-serif; color: #172033; }
    h1, h2 { line-height: 1.2; }
  </style>
</head>
<body>
  <h1>LifeQuest Companion Privacy Policy</h1>
  <p>Effective July 29, 2026.</p>
  <p>LifeQuest Companion is a private GPT Action for its account owner. It sends only the Action requests needed to read or update that owner's LifeQuest data.</p>
  <h2>Data processing</h2>
  <p>The Action receives request parameters from ChatGPT, authenticates the request with a private bearer token, and uses a dedicated Firebase account to read or update the owner's LifeQuest snapshot. The Action does not sell data, serve advertising, or intentionally retain request content outside Firebase.</p>
  <h2>Service providers</h2>
  <p>OpenAI, Cloudflare, and Google Firebase process requests as necessary to provide ChatGPT, the Action endpoint, authentication, and database storage under their respective privacy terms.</p>
  <h2>Access and deletion</h2>
  <p>The account owner controls the underlying LifeQuest and Firebase accounts and can review or delete stored LifeQuest data there. The Action does not expose permanent deletion operations.</p>
</body>
</html>`;

const json = (
    payload,
    status = 200,
    requestId = crypto.randomUUID(),
    includeRequestId = true
) => new Response(
    JSON.stringify(includeRequestId ? { ...payload, requestId } : payload),
    {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'x-request-id': requestId
        }
    }
);

const readJsonBody = async (request) => {
    if (!request.body) return {};
    const contentLength = Number(request.headers.get('content-length') || 0);
    assertHttp(
        !contentLength || contentLength <= MAX_ACTION_BODY_BYTES,
        413,
        'The request body is too large.',
        'request_too_large'
    );
    const text = await request.text();
    assertHttp(
        new TextEncoder().encode(text).byteLength <= MAX_ACTION_BODY_BYTES,
        413,
        'The request body is too large.',
        'request_too_large'
    );
    if (!text.trim()) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new HttpError(400, 'Request body must be valid JSON.', 'invalid_json');
    }
};

const authorize = (request, env) => {
    assertHttp(env.LIFEQUEST_ACTION_TOKEN, 500, 'LIFEQUEST_ACTION_TOKEN is not configured.', 'configuration_error');
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    assertHttp(token && token === env.LIFEQUEST_ACTION_TOKEN, 401, 'A valid LifeQuest bearer token is required.', 'unauthorized');
};

const mutationResponse = (snapshot, clock, result, metadata, kind) => ({
    ok: true,
    changed: result.changed !== false,
    [kind]: kind === 'quest'
        ? questView(result.quest)
        : protocolView(result.protocol, clock.todayKey),
    dashboard: dashboardView(snapshot, clock.todayKey),
    revisionId: metadata.revisionId
});

const handleQuestMutation = async (action, id, snapshot, clock) => {
    switch (action) {
        case 'complete':
            return completeQuest(snapshot, id, clock.now);
        case 'undo':
            return undoQuest(snapshot, id, clock.now);
        case 'discard':
            return discardQuest(snapshot, id, clock.now);
        case 'restore':
            return restoreQuest(snapshot, id);
        case 'select-for-today':
            return setQuestToday(snapshot, id, true);
        case 'remove-from-today':
            return setQuestToday(snapshot, id, false);
        default:
            throw new HttpError(404, 'Unknown quest action.', 'route_not_found');
    }
};

const handleProtocolMutation = async (action, id, snapshot, clock, body) => {
    switch (action) {
        case 'complete':
            return completeProtocol(snapshot, id, clock.todayKey, clock.now, body.requestId);
        case 'skip':
            return skipProtocol(snapshot, id, clock.todayKey);
        case 'activate':
            return activateProtocol(snapshot, id);
        case 'deactivate':
            return deactivateProtocol(snapshot, id, clock.todayKey);
        default:
            throw new HttpError(404, 'Unknown protocol action.', 'route_not_found');
    }
};

const handleRequest = async (request, env) => {
    const url = new URL(request.url);
    const pathname = url.pathname.length > 1
        ? url.pathname.replace(/\/+$/, '')
        : url.pathname;

    if (request.method === 'GET' && pathname === '/health') {
        return json({ ok: true, service: 'lifequest-action-api' });
    }
    if (request.method === 'GET' && pathname === '/openapi.json') {
        return json(createOpenApiDocument(url.origin), 200, crypto.randomUUID(), false);
    }
    if (request.method === 'GET' && pathname === '/privacy') {
        return new Response(PRIVACY_POLICY, {
            headers: {
                'content-type': 'text/html; charset=utf-8',
                'cache-control': 'public, max-age=3600'
            }
        });
    }

    authorize(request, env);
    assertHttp(['GET', 'POST'].includes(request.method), 405, 'Method not allowed.', 'method_not_allowed');

    const clock = getRequestClock(env);
    const loaded = await loadSnapshot(env);
    const snapshot = prepareSnapshot(loaded.snapshot);

    if (request.method === 'GET' && (pathname === '/v1/today' || pathname === '/v1/dashboard')) {
        return json({ dashboard: dashboardView(snapshot, clock.todayKey) });
    }
    if (request.method === 'GET' && pathname === '/v1/quests') {
        return json(listQuestView(snapshot, clock.todayKey, url.searchParams));
    }
    if (request.method === 'GET' && pathname === '/v1/protocols') {
        return json(listProtocolView(snapshot, clock.todayKey, url.searchParams));
    }

    const body = await readJsonBody(request);
    let result;
    let kind;

    if (request.method === 'POST' && pathname === '/v1/quests') {
        result = { quest: createQuest(snapshot, body, clock.now), changed: true };
        kind = 'quest';
    } else if (request.method === 'POST' && pathname === '/v1/protocols') {
        result = { protocol: createProtocol(snapshot, body, clock.now), changed: true };
        kind = 'protocol';
    } else {
        const questMatch = pathname.match(/^\/v1\/quests\/([^/]+)\/([^/]+)$/);
        const protocolMatch = pathname.match(/^\/v1\/protocols\/([^/]+)\/([^/]+)$/);
        if (request.method === 'POST' && questMatch) {
            result = await handleQuestMutation(
                decodeURIComponent(questMatch[2]),
                decodeURIComponent(questMatch[1]),
                snapshot,
                clock
            );
            kind = 'quest';
        } else if (request.method === 'POST' && protocolMatch) {
            result = await handleProtocolMutation(
                decodeURIComponent(protocolMatch[2]),
                decodeURIComponent(protocolMatch[1]),
                snapshot,
                clock,
                body
            );
            kind = 'protocol';
        } else {
            throw new HttpError(404, 'Unknown LifeQuest API route.', 'route_not_found');
        }
    }

    touchSnapshot(snapshot, clock.now);
    const metadata = await saveSnapshot(env, loaded, snapshot);
    return json(mutationResponse(snapshot, clock, result, metadata, kind));
};

export default {
    async fetch(request, env) {
        const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
        try {
            return await handleRequest(request, env);
        } catch (error) {
            const status = error instanceof HttpError ? error.status : 500;
            const code = error instanceof HttpError ? error.code : 'internal_error';
            const message = error instanceof HttpError
                ? error.message
                : 'The LifeQuest API encountered an unexpected error.';
            const response = {
                ok: false,
                error: { code, message }
            };
            if (env.LIFEQUEST_DEBUG === 'true' && error?.details) {
                response.error.details = error.details;
            }
            return json(response, status, requestId);
        }
    }
};

export { handleRequest };

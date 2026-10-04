import { HttpError, assertHttp } from './errors.js';
import { authorize, json, readJsonBody } from './http.js';
import { handleMcpRequest, MCP_PATH } from './mcp.js';
import { createOpenApiDocument } from './openapi.js';
import {
    applyProtocolAction,
    applyQuestAction,
    createProtocolRecord,
    createQuestRecord,
    getToday,
    listProtocols,
    listQuests
} from './operations.js';

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
  <p>Effective October 3, 2026.</p>
  <p>LifeQuest Companion is a private assistant connector for its account owner, available as a Custom GPT Action and as a Model Context Protocol (MCP) server. It handles only the requests needed to read or update that owner's LifeQuest data.</p>
  <h2>Data processing</h2>
  <p>The connector receives request parameters from the owner's AI assistant, authenticates the request with a private bearer token, and uses a dedicated Firebase account to read or update the owner's LifeQuest snapshot. The connector does not sell data, serve advertising, or intentionally retain request content outside Firebase.</p>
  <h2>Service providers</h2>
  <p>The AI assistant provider the owner connects (such as OpenAI or Anthropic), Cloudflare, and Google Firebase process requests as necessary to provide the assistant, the connector endpoint, authentication, and database storage under their respective privacy terms.</p>
  <h2>Access and deletion</h2>
  <p>The account owner controls the underlying LifeQuest and Firebase accounts and can review or delete stored LifeQuest data there. The connector does not expose permanent deletion operations.</p>
</body>
</html>`;

const handleRestRoute = async (request, env, url, pathname) => {
    if (request.method === 'GET' && (pathname === '/v1/today' || pathname === '/v1/dashboard')) {
        return getToday(env);
    }
    if (request.method === 'GET' && pathname === '/v1/quests') {
        return listQuests(env, url.searchParams);
    }
    if (request.method === 'GET' && pathname === '/v1/protocols') {
        return listProtocols(env, url.searchParams);
    }

    const body = await readJsonBody(request);
    if (request.method === 'POST' && pathname === '/v1/quests') {
        return createQuestRecord(env, body);
    }
    if (request.method === 'POST' && pathname === '/v1/protocols') {
        return createProtocolRecord(env, body);
    }
    const questMatch = pathname.match(/^\/v1\/quests\/([^/]+)\/([^/]+)$/);
    if (request.method === 'POST' && questMatch) {
        return applyQuestAction(env, decodeURIComponent(questMatch[1]), decodeURIComponent(questMatch[2]));
    }
    const protocolMatch = pathname.match(/^\/v1\/protocols\/([^/]+)\/([^/]+)$/);
    if (request.method === 'POST' && protocolMatch) {
        return applyProtocolAction(env, decodeURIComponent(protocolMatch[1]), decodeURIComponent(protocolMatch[2]), body);
    }
    throw new HttpError(404, 'Unknown LifeQuest API route.', 'route_not_found');
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
    if (pathname === MCP_PATH) {
        return handleMcpRequest(request, env);
    }

    authorize(request, env);
    assertHttp(['GET', 'POST'].includes(request.method), 405, 'Method not allowed.', 'method_not_allowed');
    return json(await handleRestRoute(request, env, url, pathname));
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

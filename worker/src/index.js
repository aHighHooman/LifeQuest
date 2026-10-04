import { HttpError } from './errors.js';
import { json } from './http.js';
import { handleMcpRequest, MCP_PATH } from './mcp.js';

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
  <p>LifeQuest Companion is a private assistant connector for its account owner, available as a Model Context Protocol (MCP) server. It handles only the requests needed to read or update that owner's LifeQuest data.</p>
  <h2>Data processing</h2>
  <p>The connector receives request parameters from the owner's AI assistant, authenticates the request with a private bearer token, and uses a dedicated Firebase account to read or update the owner's LifeQuest snapshot. The connector does not sell data, serve advertising, or intentionally retain request content outside Firebase.</p>
  <h2>Service providers</h2>
  <p>The AI assistant provider the owner connects (such as Anthropic or OpenAI), Cloudflare, and Google Firebase process requests as necessary to provide the assistant, the connector endpoint, authentication, and database storage under their respective privacy terms.</p>
  <h2>Access and deletion</h2>
  <p>The account owner controls the underlying LifeQuest and Firebase accounts and can review or delete stored LifeQuest data there. The connector does not expose permanent deletion operations.</p>
</body>
</html>`;

const handleRequest = async (request, env) => {
    const url = new URL(request.url);
    const pathname = url.pathname.length > 1
        ? url.pathname.replace(/\/+$/, '')
        : url.pathname;

    if (request.method === 'GET' && pathname === '/health') {
        return json({ ok: true, service: 'lifequest-action-api' });
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
    throw new HttpError(404, 'Unknown LifeQuest route.', 'route_not_found');
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
                : 'LifeQuest encountered an unexpected error.';
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

// OAuth 2.1 for the MCP endpoint, so chat clients (claude.ai, Claude mobile,
// ChatGPT connectors) can connect. The Worker is both the authorization server
// and its only protected resource. The owner's static action token keeps
// working alongside OAuth for clients that can send a fixed header.
import { OAuthProvider, insufficientScope } from '@cloudflare/workers-oauth-provider';
import { MCP_PATH, handleMcpRequest } from './mcp.js';

export const LIFEQUEST_SCOPE = 'lifequest';
export const SUPPORTED_SCOPES = [LIFEQUEST_SCOPE, 'offline_access'];

const DAY_SECONDS = 24 * 60 * 60;

const sha256 = async (value) => new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
);

// Compares fixed-length digests so the time taken does not reveal how much of
// a guess matched.
export const secretsMatch = async (candidate, expected) => {
    if (typeof candidate !== 'string' || typeof expected !== 'string' || !expected) return false;
    const [left, right] = await Promise.all([sha256(candidate), sha256(expected)]);
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
    return difference === 0;
};

const mcpApiHandler = {
    fetch(request, env, ctx) {
        const viaActionToken = ctx.props?.via === 'action-token';
        if (!viaActionToken && !ctx.auth?.scope?.includes(LIFEQUEST_SCOPE)) {
            return insufficientScope(ctx.auth, [LIFEQUEST_SCOPE]);
        }
        return handleMcpRequest(request, env);
    }
};

// The canonical resource URL comes from the request origin, so no deployment
// URL is written into the repository. Workers only receive requests for the
// hostnames they are routed to.
const providers = new Map();

export const getOAuthProvider = (origin, defaultHandler) => {
    if (!providers.has(origin)) {
        const resource = `${origin}${MCP_PATH}`;
        providers.set(origin, new OAuthProvider({
            apiRoute: MCP_PATH,
            apiHandler: mcpApiHandler,
            defaultHandler,
            authorizeEndpoint: '/authorize',
            tokenEndpoint: '/token',
            clientRegistrationEndpoint: '/register',
            // Clients fall back to dynamic registration; metadata documents
            // would need outbound fetches to arbitrary client URLs.
            clientIdMetadataDocumentEnabled: false,
            scopesSupported: SUPPORTED_SCOPES,
            requiredScopes: [LIFEQUEST_SCOPE],
            // A grant lasts while it is used at least monthly.
            refreshTokenTTL: 30 * DAY_SECONDS,
            refreshTokenIdleTTL: 30 * DAY_SECONDS,
            resourceMetadata: {
                resource,
                authorization_servers: [origin],
                bearer_methods_supported: ['header'],
                resource_name: 'LifeQuest'
            },
            resolveExternalToken: async ({ token, env }) => (
                await secretsMatch(token, env.LIFEQUEST_ACTION_TOKEN)
                    ? { props: { via: 'action-token' }, audience: resource }
                    : null
            )
        }));
    }
    return providers.get(origin);
};

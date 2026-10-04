// The OAuth consent page. The owner proves who they are with a passphrase
// (a Worker secret) and approves the connecting app. The library keeps the
// authorization request server-side; the form carries only a one-time handle.
import { AuthorizationError, CimdFetchError } from '@cloudflare/workers-oauth-provider';
import { LIFEQUEST_SCOPE, SUPPORTED_SCOPES, secretsMatch } from './oauth.js';

export const AUTHORIZE_PATH = '/authorize';
export const MIN_PASSPHRASE_LENGTH = 16;

const FAILURE_KEY = 'lifequest:authorize-failures';
const MAX_FAILURES = 10;
const FAILURE_WINDOW_SECONDS = 15 * 60;
const FAILURE_DELAY_MS = 1000;

const escape = (value) => `${value ?? ''}`.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const page = (title, body, status = 200, headers = new Headers()) => {
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.set('cache-control', 'no-store');
    headers.set('referrer-policy', 'no-referrer');
    headers.append('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
    return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b1120; color: #e2e8f0; font: 16px/1.5 system-ui, sans-serif; }
    main { width: min(100% - 32px, 26rem); padding: 1.5rem; border: 1px solid #1e293b; border-radius: 12px; background: #0f172a; }
    h1 { margin: 0 0 .75rem; font-size: 1.25rem; }
    p { margin: .5rem 0; color: #cbd5e1; }
    strong { color: #f8fafc; }
    .warning { padding: .5rem .75rem; border-radius: 8px; background: #422006; color: #fde68a; }
    label { display: block; margin-top: 1rem; font-size: .875rem; color: #94a3b8; }
    input[type=password] { box-sizing: border-box; width: 100%; margin-top: .25rem; padding: .625rem .75rem; border: 1px solid #334155; border-radius: 8px; background: #020617; color: inherit; font: inherit; }
    .actions { display: flex; gap: .75rem; margin-top: 1.25rem; }
    button { flex: 1; padding: .625rem; border: 1px solid #334155; border-radius: 8px; background: #1e293b; color: inherit; font: inherit; cursor: pointer; }
    button[value=approve] { border-color: #2563eb; background: #2563eb; color: #fff; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`, { status, headers });
};

const errorPage = (message, status = 400) => page('LifeQuest sign-in', `
  <h1>Could not connect</h1>
  <p>${escape(message)}</p>`, status);

const consentPage = (details, handle, headers) => {
    const origin = details.clientDomain
        ? `Published by <strong>${escape(details.clientDomain)}</strong>.`
        : 'This app registered itself, so its name is not verified.';
    const scopes = [...new Set([LIFEQUEST_SCOPE, ...details.scope])]
        .filter((scope) => SUPPORTED_SCOPES.includes(scope))
        .map((scope) => `<input type="hidden" name="scope" value="${escape(scope)}">`)
        .join('');
    return page(`Connect ${details.clientName} to LifeQuest`, `
  <h1>Connect <strong>${escape(details.clientName)}</strong> to LifeQuest?</h1>
  <p>It will be able to read and change your quests, protocols, and rewards.</p>
  <p>${origin} Access will be sent to <strong>${escape(details.redirectHost)}</strong>.</p>
  ${details.redirectIsLoopback ? '<p class="warning">This sends access to an app on this computer. Continue only if you just started connecting from it.</p>' : ''}
  <form method="post">
    <input type="hidden" name="handle" value="${escape(handle)}">
    ${scopes}
    <label>Owner passphrase
      <input type="password" name="passphrase" autocomplete="current-password" required>
    </label>
    <div class="actions">
      <button name="decision" value="deny" formnovalidate>Deny</button>
      <button name="decision" value="approve">Allow</button>
    </div>
  </form>`, 200, headers);
};

const ownerPassphrase = (env) => {
    const passphrase = env.LIFEQUEST_OWNER_PASSPHRASE;
    return typeof passphrase === 'string' && passphrase.length >= MIN_PASSPHRASE_LENGTH ? passphrase : null;
};

const recentFailures = async (env) => Number(await env.OAUTH_KV.get(FAILURE_KEY)) || 0;

const recordFailure = async (env) => {
    await env.OAUTH_KV.put(FAILURE_KEY, `${(await recentFailures(env)) + 1}`, {
        expirationTtl: FAILURE_WINDOW_SECONDS
    });
};

const redirect = (location, headers = new Headers()) => {
    headers.set('location', location);
    return new Response(null, { status: 302, headers });
};

const showConsent = async (request, env) => {
    const oauth = env.OAUTH_PROVIDER;
    const authRequest = await oauth.parseAuthRequest(request);
    const details = await oauth.describeConsent(authRequest);
    const consent = await oauth.beginConsent(authRequest);
    return consentPage(details, consent.handle, consent.headers);
};

const decideConsent = async (request, env) => {
    const oauth = env.OAUTH_PROVIDER;
    const form = await request.formData();
    const handle = `${form.get('handle') ?? ''}`;

    if (form.get('decision') !== 'approve') {
        const denied = await oauth.denyConsent(request, handle);
        return new Response(null, { status: 302, headers: denied.headers });
    }

    const expected = ownerPassphrase(env);
    if (!expected) return errorPage('LifeQuest sign-in is not configured yet.', 500);
    if (await recentFailures(env) >= MAX_FAILURES) {
        return errorPage('Too many incorrect passphrases. Wait 15 minutes, then start connecting again.', 429);
    }
    if (!await secretsMatch(`${form.get('passphrase') ?? ''}`, expected)) {
        await recordFailure(env);
        await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
        return errorPage('That passphrase is incorrect. Go back and try again.', 401);
    }

    const scope = [...new Set([LIFEQUEST_SCOPE, ...form.getAll('scope').map(String)])]
        .filter((entry) => SUPPORTED_SCOPES.includes(entry));
    const approved = await oauth.approveConsent(request, handle, { scope });
    const { redirectTo } = await oauth.completeAuthorization({
        request: approved.request,
        userId: 'owner',
        metadata: {},
        scope: approved.request.scope,
        props: { via: 'oauth' }
    });
    return redirect(redirectTo, approved.headers);
};

export const handleAuthorize = async (request, env) => {
    try {
        if (request.method === 'GET') return await showConsent(request, env);
        if (request.method === 'POST') return await decideConsent(request, env);
        return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });
    } catch (error) {
        // Redirect only once the client and its exact redirect URI are trusted.
        if (error instanceof AuthorizationError && error.redirectTo) return redirect(error.redirectTo);
        if (error instanceof AuthorizationError) {
            return errorPage(request.method === 'POST'
                ? 'This sign-in page expired or was already used. Start connecting again from the app.'
                : error.description);
        }
        if (error instanceof CimdFetchError) return errorPage('This app could not be verified.');
        throw error;
    }
};

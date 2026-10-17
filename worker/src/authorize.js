// The OAuth consent page. The owner proves who they are with a passphrase
// (a Worker secret) and approves the connecting app. The library keeps the
// authorization request server-side; the form carries only a one-time handle.
import { AuthorizationError, CimdFetchError } from '@cloudflare/workers-oauth-provider';
import { LIFEQUEST_SCOPE, SUPPORTED_SCOPES } from './oauth.js';
import { getOwnerPassphrase } from './ownerSignInLimiter.js';

export const AUTHORIZE_PATH = '/authorize';
export { MIN_PASSPHRASE_LENGTH } from './ownerSignInLimiter.js';

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

const errorPage = (message, status = 400, headers) => page('LifeQuest sign-in', `
  <h1>Could not connect</h1>
  <p>${escape(message)}</p>`, status, headers);

const consentPage = (details, handle, headers, message = '', status = 200) => {
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
  ${message ? `<p class="warning" role="alert">${escape(message)}</p>` : ''}
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
  </form>`, status, headers);
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

const clientLimiterId = async (request, namespace) => {
    // Cloudflare sets these at the edge. Do not use caller-controlled forwarding
    // headers, and keep the address out of durable object names and storage.
    const address = request.headers.get('cf-connecting-ipv6') || request.headers.get('cf-connecting-ip') || 'local';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return namespace.idFromName(`client-${hash}`);
};

const decideConsent = async (request, env) => {
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
        return errorPage('Start connecting from the app and use its LifeQuest sign-in page.');
    }
    const oauth = env.OAUTH_PROVIDER;
    const form = await request.formData();
    const handle = `${form.get('handle') ?? ''}`;

    if (form.get('decision') !== 'approve') {
        const denied = await oauth.denyConsent(request, handle);
        return new Response(null, { status: 302, headers: denied.headers });
    }

    const namespace = env.OWNER_SIGN_IN_LIMITER;
    if (!getOwnerPassphrase(env) || !namespace) return errorPage('LifeQuest sign-in is not configured yet.', 500);
    const scope = [...new Set([LIFEQUEST_SCOPE, ...form.getAll('scope').map(String)])]
        .filter((entry) => SUPPORTED_SCOPES.includes(entry));
    // Validate and consume the cookie-bound handle before checking a secret or
    // spending the failure budget. This creates no grant until authorization below.
    const approved = await oauth.approveConsent(request, handle, { scope });
    const limiter = namespace.get(await clientLimiterId(request, namespace));
    const result = await limiter.verifyPassphrase(`${form.get('passphrase') ?? ''}`);
    if (result.status === 'locked') {
        approved.headers.set('retry-after', `${result.retryAfterSeconds}`);
        return errorPage('Too many incorrect passphrases. Wait 15 minutes, then start connecting again.', 429,
            approved.headers);
    }
    if (result.status === 'incorrect') {
        // Delay the response outside the object so it can promptly lock the
        // remaining requests in a burst instead of queueing a second per guess.
        await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
        const details = await oauth.describeConsent(approved.request);
        const retry = await oauth.beginConsent(approved.request);
        retry.headers.forEach((value, key) => approved.headers.append(key, value));
        return consentPage(details, retry.handle, approved.headers, 'That passphrase is incorrect. Try again.', 401);
    }
    if (result.status !== 'allowed') return errorPage('LifeQuest sign-in is not configured yet.', 500, approved.headers);
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

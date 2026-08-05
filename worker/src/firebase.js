import { HttpError, assertHttp } from './errors.js';

let cachedToken = null;

const parseJsonResponse = async (response) => {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        throw new HttpError(502, 'Firebase returned an invalid response.', 'firebase_invalid_response');
    }
};

export const getFirebaseIdToken = async (env, forceRefresh = false) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!forceRefresh && cachedToken?.expiresAt > nowSeconds + 60) {
        return cachedToken.value;
    }

    assertHttp(env.FIREBASE_API_KEY, 500, 'FIREBASE_API_KEY is not configured.', 'configuration_error');
    assertHttp(env.FIREBASE_LLM_EMAIL, 500, 'FIREBASE_LLM_EMAIL is not configured.', 'configuration_error');
    assertHttp(env.FIREBASE_LLM_PASSWORD, 500, 'FIREBASE_LLM_PASSWORD is not configured.', 'configuration_error');

    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: env.FIREBASE_LLM_EMAIL,
                password: env.FIREBASE_LLM_PASSWORD,
                returnSecureToken: true
            })
        }
    );
    const payload = await parseJsonResponse(response);
    if (!response.ok || !payload?.idToken) {
        throw new HttpError(
            502,
            'The LifeQuest API could not authenticate its Firebase machine account.',
            'firebase_auth_failed',
            payload?.error?.message
        );
    }

    cachedToken = {
        value: payload.idToken,
        expiresAt: nowSeconds + Math.max(60, Number(payload.expiresIn) || 3600)
    };
    return cachedToken.value;
};

export const firebaseFetch = async (env, url, init = {}, allowRetry = true) => {
    const token = await getFirebaseIdToken(env);
    const response = await fetch(url, {
        ...init,
        headers: {
            ...(init.headers || {}),
            authorization: `Bearer ${token}`
        }
    });

    if (response.status === 401 && allowRetry) {
        await getFirebaseIdToken(env, true);
        return firebaseFetch(env, url, init, false);
    }

    return response;
};

export const readFirebaseJson = async (response) => parseJsonResponse(response);

import { HttpError, assertHttp } from './errors.js';

const MAX_BODY_BYTES = 64 * 1024;

export const json = (
    payload,
    status = 200,
    requestId = crypto.randomUUID(),
    includeRequestId = true,
    headers = {}
) => new Response(
    JSON.stringify(includeRequestId ? { ...payload, requestId } : payload),
    {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'x-request-id': requestId,
            ...headers
        }
    }
);

export const readJsonBody = async (request) => {
    if (!request.body) return {};
    const contentLength = Number(request.headers.get('content-length') || 0);
    assertHttp(
        !contentLength || contentLength <= MAX_BODY_BYTES,
        413,
        'The request body is too large.',
        'request_too_large'
    );
    const text = await request.text();
    assertHttp(
        new TextEncoder().encode(text).byteLength <= MAX_BODY_BYTES,
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

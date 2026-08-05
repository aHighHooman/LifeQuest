export class HttpError extends Error {
    constructor(status, message, code = 'request_failed', details = undefined) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export const assertHttp = (condition, status, message, code, details) => {
    if (!condition) {
        throw new HttpError(status, message, code, details);
    }
};

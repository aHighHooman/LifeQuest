import { firebaseFetch, readFirebaseJson } from './firebase.js';
import { HttpError, assertHttp } from './errors.js';

export const decodeFirestoreValue = (value = {}) => {
    if ('nullValue' in value) return null;
    if ('booleanValue' in value) return Boolean(value.booleanValue);
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('timestampValue' in value) return value.timestampValue;
    if ('stringValue' in value) return value.stringValue;
    if ('bytesValue' in value) return value.bytesValue;
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
    if ('mapValue' in value) return decodeFirestoreFields(value.mapValue.fields || {});
    return undefined;
};

export const decodeFirestoreFields = (fields = {}) => Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
);

export const encodeFirestoreValue = (value) => {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? { integerValue: `${value}` }
            : { doubleValue: value };
    }
    if (typeof value === 'string') return { stringValue: value };
    if (Array.isArray(value)) {
        return { arrayValue: { values: value.map(encodeFirestoreValue) } };
    }
    return { mapValue: { fields: encodeFirestoreFields(value) } };
};

export const encodeFirestoreFields = (value = {}) => Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, encodeFirestoreValue(entry)])
);

const databaseRoot = (env) => {
    assertHttp(env.FIREBASE_PROJECT_ID, 500, 'FIREBASE_PROJECT_ID is not configured.', 'configuration_error');
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)`;
};

export const documentName = (env, path) => (
    `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`
);

export const getDocument = async (env, path) => {
    const response = await firebaseFetch(
        env,
        `${databaseRoot(env)}/documents/${path.split('/').map(encodeURIComponent).join('/')}`
    );
    if (response.status === 404) return null;
    const payload = await readFirebaseJson(response);
    if (!response.ok) {
        throw new HttpError(
            502,
            'Firestore could not load LifeQuest state.',
            'firestore_read_failed',
            payload?.error?.message
        );
    }
    return {
        name: payload.name,
        fields: decodeFirestoreFields(payload.fields),
        createTime: payload.createTime,
        updateTime: payload.updateTime
    };
};

export const commitDocuments = async (env, writes) => {
    const response = await firebaseFetch(
        env,
        `${databaseRoot(env)}/documents:commit`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ writes })
        }
    );
    const payload = await readFirebaseJson(response);
    if (!response.ok) {
        const status = payload?.error?.status;
        if (status === 'ABORTED' || status === 'FAILED_PRECONDITION') {
            throw new HttpError(
                409,
                'LifeQuest changed while this action was running. Fetch the latest state and try again.',
                'snapshot_conflict'
            );
        }
        throw new HttpError(
            502,
            'Firestore could not save LifeQuest state.',
            'firestore_write_failed',
            payload?.error?.message
        );
    }
    return payload;
};

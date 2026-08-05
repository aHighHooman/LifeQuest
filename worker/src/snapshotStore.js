import {
    commitDocuments,
    documentName,
    encodeFirestoreFields,
    getDocument
} from './firestore.js';
import { HttpError, assertHttp } from './errors.js';
import {
    CURRENT_CURRENCY_UNIT_VERSION,
    CURRENT_SNAPSHOT_FORMAT_VERSION
} from './snapshotFormat.js';

const CHUNK_BYTES = 256 * 1024;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const MAX_CHUNKS = MAX_SNAPSHOT_BYTES / CHUNK_BYTES;

const bytesToBase64 = (bytes) => {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
};

const base64ToBytes = (value) => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};

const splitBytes = (bytes) => {
    assertHttp(bytes.byteLength <= MAX_SNAPSHOT_BYTES, 413, 'The LifeQuest snapshot exceeds 8 MiB.', 'snapshot_too_large');
    const chunks = [];
    for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_BYTES) {
        chunks.push(bytes.slice(offset, offset + CHUNK_BYTES));
    }
    return chunks.length ? chunks : [new Uint8Array()];
};

const joinBytes = (chunks) => {
    const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const bytes = new Uint8Array(length);
    let offset = 0;
    chunks.forEach((chunk) => {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    });
    return bytes;
};

const sha256 = async (bytes) => {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
};

const snapshotPaths = (env, revisionId = null) => {
    const ownerUid = env.LIFEQUEST_OWNER_UID;
    assertHttp(ownerUid, 500, 'LIFEQUEST_OWNER_UID is not configured.', 'configuration_error');
    const ownerRoot = `users/${ownerUid}`;
    return {
        manifest: `${ownerRoot}/sync/current`,
        revision: revisionId ? `${ownerRoot}/snapshotRevisions/${revisionId}` : null,
        chunk: (index) => `${ownerRoot}/snapshotRevisions/${revisionId}/chunks/${`${index}`.padStart(4, '0')}`
    };
};

export const loadSnapshot = async (env) => {
    const paths = snapshotPaths(env);
    const manifestDocument = await getDocument(env, paths.manifest);
    if (!manifestDocument) {
        throw new HttpError(404, 'No LifeQuest cloud snapshot exists yet.', 'snapshot_not_found');
    }
    const manifest = manifestDocument.fields;
    assertHttp(manifest.kind === 'lifequest', 409, 'The cloud account does not contain a LifeQuest snapshot.', 'unsupported_snapshot');
    const chunkCount = Number(manifest.chunkCount);
    assertHttp(Number.isInteger(chunkCount) && chunkCount > 0 && chunkCount <= MAX_CHUNKS, 502, 'The cloud snapshot manifest has an invalid chunk count.', 'invalid_snapshot');

    const revisionPaths = snapshotPaths(env, manifest.revisionId);
    const documents = await Promise.all(
        Array.from({ length: chunkCount }, (_, index) => getDocument(env, revisionPaths.chunk(index)))
    );
    assertHttp(documents.every(Boolean), 502, 'The cloud snapshot is incomplete.', 'invalid_snapshot');
    const chunks = documents.map((document, index) => {
        assertHttp(Number(document.fields.index) === index, 502, 'A cloud snapshot chunk is out of order.', 'invalid_snapshot');
        return base64ToBytes(document.fields.data);
    });
    const bytes = joinBytes(chunks);
    assertHttp(bytes.byteLength === Number(manifest.byteLength), 502, 'The cloud snapshot byte length is invalid.', 'invalid_snapshot');
    assertHttp(await sha256(bytes) === manifest.checksum, 502, 'The cloud snapshot checksum is invalid.', 'invalid_snapshot');

    let snapshot;
    try {
        snapshot = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        throw new HttpError(502, 'The cloud snapshot is not valid JSON.', 'invalid_snapshot');
    }

    return {
        snapshot,
        manifest,
        manifestUpdateTime: manifestDocument.updateTime
    };
};

export const saveSnapshot = async (env, loaded, snapshot) => {
    assertHttp(
        Number(snapshot?.formatVersion) === CURRENT_SNAPSHOT_FORMAT_VERSION
            && Number(snapshot?.currencyUnitVersion) >= CURRENT_CURRENCY_UNIT_VERSION,
        502,
        'The LifeQuest API produced an unsupported snapshot format.',
        'invalid_snapshot'
    );
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
    const chunks = splitBytes(bytes);
    const checksum = await sha256(bytes);
    const { generatedAt: _generatedAt, ...logicalState } = snapshot;
    const stateChecksum = await sha256(new TextEncoder().encode(JSON.stringify(logicalState)));
    const revisionId = crypto.randomUUID();
    const updatedAt = new Date().toISOString();
    const metadata = {
        revisionId,
        formatVersion: Number(snapshot.formatVersion || 0),
        currencyUnitVersion: Number(snapshot.currencyUnitVersion || 0),
        chunkCount: chunks.length,
        byteLength: bytes.byteLength,
        checksum,
        stateChecksum,
        kind: 'lifequest',
        updatedAt
    };
    const metadataFields = {
        ...encodeFirestoreFields(metadata),
        updatedAt: { timestampValue: updatedAt }
    };
    const paths = snapshotPaths(env, revisionId);
    const writes = chunks.map((chunk, index) => ({
        update: {
            name: documentName(env, paths.chunk(index)),
            fields: {
                index: { integerValue: `${index}` },
                data: { bytesValue: bytesToBase64(chunk) }
            }
        }
    }));
    writes.push({
        update: {
            name: documentName(env, paths.revision),
            fields: metadataFields
        }
    });
    writes.push({
        update: {
            name: documentName(env, paths.manifest),
            fields: metadataFields
        },
        currentDocument: loaded.manifestUpdateTime
            ? { updateTime: loaded.manifestUpdateTime }
            : { exists: false }
    });
    await commitDocuments(env, writes);
    return metadata;
};

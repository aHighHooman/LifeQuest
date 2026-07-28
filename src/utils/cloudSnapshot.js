import {
    Bytes,
    doc,
    getDoc,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore';

export const CLOUD_CHUNK_BYTES = 256 * 1024;
export const CLOUD_MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
export const CLOUD_MAX_CHUNKS = CLOUD_MAX_SNAPSHOT_BYTES / CLOUD_CHUNK_BYTES;

export class CloudSnapshotConflictError extends Error {
    constructor(message = 'The cloud snapshot changed on another device.') {
        super(message);
        this.name = 'CloudSnapshotConflictError';
    }
}

export const encodeSnapshot = (snapshot) => new TextEncoder().encode(JSON.stringify(snapshot));

export const splitSnapshotBytes = (bytes, chunkSize = CLOUD_CHUNK_BYTES) => {
    if (!(bytes instanceof Uint8Array)) {
        throw new TypeError('Snapshot bytes must be a Uint8Array.');
    }

    if (bytes.byteLength > CLOUD_MAX_SNAPSHOT_BYTES) {
        throw new Error('The snapshot is too large for the guarded cloud transfer limit.');
    }

    const chunks = [];
    for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
        chunks.push(bytes.slice(offset, offset + chunkSize));
    }

    return chunks.length > 0 ? chunks : [new Uint8Array()];
};

export const joinSnapshotChunks = (chunks) => {
    const totalLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const joined = new Uint8Array(totalLength);
    let offset = 0;

    chunks.forEach((chunk) => {
        joined.set(chunk, offset);
        offset += chunk.byteLength;
    });

    return joined;
};

export const hashSnapshotBytes = async (bytes) => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
};

export const hashPortableSnapshotState = async (snapshot) => {
    const { generatedAt: _generatedAt, ...state } = snapshot || {};
    return hashSnapshotBytes(encodeSnapshot(state));
};

const getManifestRef = (db, uid) => doc(db, 'users', uid, 'sync', 'current');
const getRevisionRef = (db, uid, revisionId) => doc(db, 'users', uid, 'snapshotRevisions', revisionId);
const getChunkRef = (db, uid, revisionId, index) => (
    doc(db, 'users', uid, 'snapshotRevisions', revisionId, 'chunks', `${index}`.padStart(4, '0'))
);

export const saveCloudSnapshot = async ({
    db,
    uid,
    snapshot,
    expectedRevisionId = null,
    kind = 'lifequest'
}) => {
    const bytes = encodeSnapshot(snapshot);
    const chunks = splitSnapshotBytes(bytes);
    const checksum = await hashSnapshotBytes(bytes);
    const stateChecksum = await hashPortableSnapshotState(snapshot);
    const revisionId = globalThis.crypto.randomUUID();
    const formatVersion = Number(snapshot?.formatVersion || 0);
    const manifestRef = getManifestRef(db, uid);
    const revisionRef = getRevisionRef(db, uid, revisionId);

    await runTransaction(db, async (transaction) => {
        const currentManifest = await transaction.get(manifestRef);
        const currentRevisionId = currentManifest.exists() ? currentManifest.data().revisionId : null;

        if (currentRevisionId !== expectedRevisionId) {
            throw new CloudSnapshotConflictError();
        }

        const metadata = {
            revisionId,
            formatVersion,
            chunkCount: chunks.length,
            byteLength: bytes.byteLength,
            checksum,
            stateChecksum,
            kind,
            updatedAt: serverTimestamp()
        };

        chunks.forEach((chunk, index) => {
            transaction.set(getChunkRef(db, uid, revisionId, index), {
                index,
                data: Bytes.fromUint8Array(chunk)
            });
        });

        transaction.set(revisionRef, metadata);
        transaction.set(manifestRef, metadata);
    });

    return {
        revisionId,
        formatVersion,
        chunkCount: chunks.length,
        byteLength: bytes.byteLength,
        checksum,
        stateChecksum,
        kind
    };
};

export const loadCloudSnapshot = async ({ db, uid }) => {
    const manifestDocument = await getDoc(getManifestRef(db, uid));
    if (!manifestDocument.exists()) return null;

    const manifest = manifestDocument.data();
    const chunkCount = Number(manifest.chunkCount);

    if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > CLOUD_MAX_CHUNKS) {
        throw new Error('The cloud manifest has an invalid chunk count.');
    }

    const chunkDocuments = await Promise.all(
        Array.from({ length: chunkCount }, (_, index) => getDoc(getChunkRef(db, uid, manifest.revisionId, index)))
    );

    if (chunkDocuments.some((chunkDocument) => !chunkDocument.exists())) {
        throw new Error('The cloud snapshot is incomplete.');
    }

    const chunks = chunkDocuments.map((chunkDocument, expectedIndex) => {
        const chunk = chunkDocument.data();
        if (chunk.index !== expectedIndex || !(chunk.data instanceof Bytes)) {
            throw new Error('The cloud snapshot contains an invalid chunk.');
        }
        return chunk.data.toUint8Array();
    });

    const bytes = joinSnapshotChunks(chunks);
    if (bytes.byteLength !== manifest.byteLength) {
        throw new Error('The cloud snapshot byte length does not match its manifest.');
    }

    const checksum = await hashSnapshotBytes(bytes);
    if (checksum !== manifest.checksum) {
        throw new Error('The cloud snapshot checksum is invalid.');
    }

    let snapshot;
    try {
        snapshot = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        throw new Error('The cloud snapshot is not valid JSON.');
    }

    return {
        manifest: {
            ...manifest,
            updatedAt: manifest.updatedAt?.toDate?.().toISOString() || null
        },
        snapshot
    };
};

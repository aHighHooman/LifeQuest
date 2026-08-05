import { describe, expect, it } from 'vitest';
import { createOpenApiDocument } from './openapi.js';

describe('LifeQuest GPT OpenAPI document', () => {
    it('publishes explicit reversible mutation operations', () => {
        const document = createOpenApiDocument('https://lifequest.example.workers.dev');
        expect(document.servers[0].url).toBe('https://lifequest.example.workers.dev');
        expect(document.paths['/v1/protocols/{id}/deactivate'].post.operationId)
            .toBe('deactivateLifeQuestProtocol');
        expect(document.paths['/v1/quests/{id}/discard'].post.operationId)
            .toBe('discardLifeQuestQuest');
        expect(document.paths['/v1/quests/{id}/restore'].post.operationId)
            .toBe('restoreLifeQuestQuest');
    });

    it('does not expose permanent deletion', () => {
        const document = createOpenApiDocument();
        expect(Object.keys(document.paths).some((path) => path.includes('delete'))).toBe(false);
    });
});

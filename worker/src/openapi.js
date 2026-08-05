const jsonResponse = {
    '200': {
        description: 'Successful LifeQuest response.',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        ok: { type: 'boolean' },
                        requestId: { type: 'string' },
                        revisionId: { type: 'string' },
                        changed: { type: 'boolean' },
                        count: { type: 'integer' },
                        dashboard: { type: 'object', properties: {}, additionalProperties: true },
                        quest: { type: 'object', properties: {}, additionalProperties: true },
                        protocol: { type: 'object', properties: {}, additionalProperties: true },
                        items: {
                            type: 'array',
                            items: { type: 'object', properties: {}, additionalProperties: true }
                        }
                    },
                    additionalProperties: true
                }
            }
        }
    }
};

const idParameter = {
    name: 'id',
    in: 'path',
    required: true,
    description: 'Exact LifeQuest record ID returned by a list or today operation.',
    schema: { type: 'string' }
};

const emptyMutation = (operationId, summary) => ({
    post: {
        operationId,
        summary,
        parameters: [idParameter],
        'x-openai-isConsequential': false,
        responses: jsonResponse
    }
});

export const createOpenApiDocument = (origin = 'https://lifequest-action-api.example.workers.dev') => ({
    openapi: '3.1.0',
    info: {
        title: 'LifeQuest Action API',
        version: '1.0.0',
        description: 'Private API for reading and updating one LifeQuest account.'
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }],
    paths: {
        '/v1/today': {
            get: {
                operationId: 'getLifeQuestToday',
                summary: 'Get dashboard stats and unfinished quests and protocols selected for today.',
                'x-openai-isConsequential': false,
                responses: jsonResponse
            }
        },
        '/v1/dashboard': {
            get: {
                operationId: 'getLifeQuestDashboard',
                summary: 'Get current health, coins, level, XP, and today records.',
                'x-openai-isConsequential': false,
                responses: jsonResponse
            }
        },
        '/v1/quests': {
            get: {
                operationId: 'listLifeQuestQuests',
                summary: 'List or search LifeQuest quests.',
                parameters: [
                    {
                        name: 'status',
                        in: 'query',
                        description: 'Quest status filter.',
                        schema: { type: 'string', enum: ['active', 'completed', 'discarded', 'all'], default: 'active' }
                    },
                    {
                        name: 'query',
                        in: 'query',
                        description: 'Optional case-insensitive title search.',
                        schema: { type: 'string' }
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Maximum records from 1 to 100.',
                        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
                    }
                ],
                'x-openai-isConsequential': false,
                responses: jsonResponse
            },
            post: {
                operationId: 'createLifeQuestQuest',
                summary: 'Create a new LifeQuest quest.',
                'x-openai-isConsequential': false,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/CreateQuest' }
                        }
                    }
                },
                responses: jsonResponse
            }
        },
        '/v1/quests/{id}/complete': emptyMutation('completeLifeQuestQuest', 'Complete a quest and apply its rewards.'),
        '/v1/quests/{id}/undo': emptyMutation('undoLifeQuestQuest', 'Undo a completed quest and revert its rewards.'),
        '/v1/quests/{id}/discard': emptyMutation('discardLifeQuestQuest', 'Move a quest to the reversible discarded state.'),
        '/v1/quests/{id}/restore': emptyMutation('restoreLifeQuestQuest', 'Restore a discarded quest.'),
        '/v1/quests/{id}/select-for-today': emptyMutation('selectLifeQuestQuestForToday', 'Select an active quest for today.'),
        '/v1/quests/{id}/remove-from-today': emptyMutation('removeLifeQuestQuestFromToday', 'Remove a quest from today.'),
        '/v1/protocols': {
            get: {
                operationId: 'listLifeQuestProtocols',
                summary: 'List or search LifeQuest protocols.',
                parameters: [
                    {
                        name: 'status',
                        in: 'query',
                        description: 'Protocol activation filter.',
                        schema: { type: 'string', enum: ['active', 'inactive', 'all'], default: 'active' }
                    },
                    {
                        name: 'query',
                        in: 'query',
                        description: 'Optional case-insensitive title search.',
                        schema: { type: 'string' }
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Maximum records from 1 to 100.',
                        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
                    }
                ],
                'x-openai-isConsequential': false,
                responses: jsonResponse
            },
            post: {
                operationId: 'createLifeQuestProtocol',
                summary: 'Create a new LifeQuest protocol.',
                'x-openai-isConsequential': false,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/CreateProtocol' }
                        }
                    }
                },
                responses: jsonResponse
            }
        },
        '/v1/protocols/{id}/complete': {
            post: {
                operationId: 'completeLifeQuestProtocol',
                summary: 'Complete a protocol for the current LifeQuest day and apply rewards.',
                parameters: [idParameter],
                'x-openai-isConsequential': false,
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/IdempotentMutation' }
                        }
                    }
                },
                responses: jsonResponse
            }
        },
        '/v1/protocols/{id}/skip': emptyMutation('skipLifeQuestProtocol', 'Skip the current protocol cycle without completing it.'),
        '/v1/protocols/{id}/activate': emptyMutation('activateLifeQuestProtocol', 'Activate a protocol.'),
        '/v1/protocols/{id}/deactivate': emptyMutation('deactivateLifeQuestProtocol', 'Deactivate a protocol and remove it from scheduling.')
    },
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                description: 'Private Action token configured in the Custom GPT editor.'
            }
        },
        schemas: {
            CreateQuest: {
                type: 'object',
                required: ['title'],
                properties: {
                    requestId: { type: 'string', description: 'A unique value reused if this exact creation request is retried.' },
                    title: { type: 'string' },
                    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard', 'legendary'], default: 'easy' },
                    dueDate: { type: ['string', 'null'], description: 'Optional local date in YYYY-MM-DD form.' },
                    missionBrief: { type: 'string' },
                    selectedForToday: { type: 'boolean', default: false },
                    reward: {
                        type: 'object',
                        properties: {
                            xp: { type: 'number', minimum: 0 },
                            gold: { type: 'number', minimum: 0 }
                        }
                    }
                }
            },
            CreateProtocol: {
                type: 'object',
                required: ['title'],
                properties: {
                    requestId: { type: 'string', description: 'A unique value reused if this exact creation request is retried.' },
                    title: { type: 'string' },
                    frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'interval'], default: 'daily' },
                    frequencyParam: { type: 'integer', minimum: 1, default: 1 },
                    completionReward: { type: 'number', minimum: 0 },
                    passiveReward: { type: 'number', minimum: 0 },
                    active: { type: 'boolean', default: false }
                }
            },
            IdempotentMutation: {
                type: 'object',
                properties: {
                    requestId: { type: 'string', description: 'A unique value reused if this exact request is retried.' }
                }
            }
        }
    }
});

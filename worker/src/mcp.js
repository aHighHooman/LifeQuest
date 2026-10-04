// Stateless Model Context Protocol endpoint (Streamable HTTP transport).
// Each POST carries one JSON-RPC message and is answered with plain JSON, so
// no session or server-sent event stream is needed. Requests reach this
// handler only after the OAuth provider has accepted their bearer token.
import { HttpError } from './errors.js';
import { json, readJsonBody } from './http.js';
import {
    PROTOCOL_ACTION_NAMES,
    QUEST_ACTION_NAMES,
    applyProtocolAction,
    applyQuestAction,
    createProtocolRecord,
    createQuestRecord,
    getToday,
    listProtocols,
    listQuests
} from './operations.js';

export const MCP_PATH = '/mcp';

// Newest first. A client asking for an unknown version is offered the newest.
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];

const SERVER_INFO = { name: 'lifequest', title: 'LifeQuest', version: '1.0.0' };

const INSTRUCTIONS = `LifeQuest is the user's private gamified tracker. Quests are one-off tasks; protocols are recurring habits whose next due date follows their last completion.

Source of truth:
- Use these tools for all current quests, protocols, dashboard values, and changes. Do not treat chat history or remembered IDs as current state.
- Fetch records again when an ID may be stale or when a tool reports a snapshot_conflict.

Reading:
- Use get_today for what remains today.
- Use list_quests or list_protocols when the user refers to a record by title. Match titles case-insensitively, but do not guess between several plausible matches; ask one short question instead.

Changing:
- Only change LifeQuest when the user clearly asks to record or change something.
- Use the exact record ID returned by a tool.
- For create_quest, create_protocol, and completing a protocol, generate a unique requestId and reuse it if the identical call is retried.
- Discarding a quest is reversible; use restore to recover it.
- Use activate and deactivate for protocols; never simulate deactivation by skipping a cycle.
- Never claim success unless the tool result has ok: true.
- On a snapshot_conflict, fetch current state and retry once if the intent is still unambiguous.

Responding:
- After a change, briefly say what changed and mention material reward changes from the result.
- Do not expose tokens, credentials, raw snapshots, or implementation details.`;

const NO_ARGUMENTS = { type: 'object', properties: {}, additionalProperties: false };

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };
const ADDITIVE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const CHANGE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

const searchParams = (args) => new URLSearchParams(
    Object.entries(args)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, `${value}`])
);

const TOOLS = [
    {
        name: 'get_today',
        title: 'Get today',
        description: 'Get today\'s LifeQuest dashboard: level, XP, coins on hand, health (remaining calorie capacity for today), active quests selected for today, and protocols due today that are not yet completed.',
        inputSchema: NO_ARGUMENTS,
        annotations: READ_ONLY,
        run: (env) => getToday(env)
    },
    {
        name: 'list_quests',
        title: 'List quests',
        description: 'List or search LifeQuest quests (one-off tasks) by status and title.',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['active', 'completed', 'discarded', 'all'], default: 'active' },
                query: { type: 'string', description: 'Optional case-insensitive title search.' },
                limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
            },
            additionalProperties: false
        },
        annotations: READ_ONLY,
        run: (env, args) => listQuests(env, searchParams(args))
    },
    {
        name: 'list_protocols',
        title: 'List protocols',
        description: 'List or search LifeQuest protocols (recurring habits) with streaks, due dates, and rewards.',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['active', 'inactive', 'all'], default: 'active' },
                query: { type: 'string', description: 'Optional case-insensitive title search.' },
                limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
            },
            additionalProperties: false
        },
        annotations: READ_ONLY,
        run: (env, args) => listProtocols(env, searchParams(args))
    },
    {
        name: 'create_quest',
        title: 'Create quest',
        description: 'Create a LifeQuest quest. Rewards default from the difficulty unless a custom reward is given.',
        inputSchema: {
            type: 'object',
            required: ['title'],
            properties: {
                requestId: { type: 'string', description: 'A unique value reused if this exact creation is retried.' },
                title: { type: 'string', minLength: 1 },
                difficulty: { type: 'string', enum: ['easy', 'medium', 'hard', 'legendary'], default: 'easy' },
                dueDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Optional local date in YYYY-MM-DD form.' },
                missionBrief: { type: 'string', description: 'Optional notes or context for the quest.' },
                selectedForToday: { type: 'boolean', default: false },
                reward: {
                    type: 'object',
                    properties: {
                        xp: { type: 'number', minimum: 0 },
                        gold: { type: 'number', minimum: 0 }
                    },
                    additionalProperties: false
                }
            },
            additionalProperties: false
        },
        annotations: ADDITIVE,
        run: (env, args) => createQuestRecord(env, args)
    },
    {
        name: 'update_quest_status',
        title: 'Update quest status',
        description: 'Change a quest\'s status. complete applies its rewards and undo reverts them; discard is reversible with restore; select-for-today and remove-from-today change whether it is in today\'s focus.',
        inputSchema: {
            type: 'object',
            required: ['id', 'action'],
            properties: {
                id: { type: 'string', minLength: 1, description: 'Exact quest ID returned by another tool.' },
                action: { type: 'string', enum: QUEST_ACTION_NAMES }
            },
            additionalProperties: false
        },
        annotations: CHANGE,
        run: (env, args) => applyQuestAction(env, args.id, args.action)
    },
    {
        name: 'create_protocol',
        title: 'Create protocol',
        description: 'Create a LifeQuest protocol (recurring habit). The next due date is counted from the last completion: daily, weekly (7 days), monthly (30 days), or every frequencyParam days for interval.',
        inputSchema: {
            type: 'object',
            required: ['title'],
            properties: {
                requestId: { type: 'string', description: 'A unique value reused if this exact creation is retried.' },
                title: { type: 'string', minLength: 1 },
                frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'interval'], default: 'daily' },
                frequencyParam: { type: 'integer', minimum: 1, default: 1, description: 'Days between cycles when frequency is interval.' },
                completionReward: { type: 'number', minimum: 0 },
                passiveReward: { type: 'number', minimum: 0 },
                active: { type: 'boolean', default: false }
            },
            additionalProperties: false
        },
        annotations: ADDITIVE,
        run: (env, args) => createProtocolRecord(env, args)
    },
    {
        name: 'update_protocol_status',
        title: 'Update protocol status',
        description: 'Change a protocol for the current LifeQuest day. complete records a completion and applies rewards; skip ends the current cycle without completing it; activate and deactivate add or remove it from scheduling.',
        inputSchema: {
            type: 'object',
            required: ['id', 'action'],
            properties: {
                id: { type: 'string', minLength: 1, description: 'Exact protocol ID returned by another tool.' },
                action: { type: 'string', enum: PROTOCOL_ACTION_NAMES },
                requestId: { type: 'string', description: 'For complete: a unique value reused if this exact completion is retried.' }
            },
            additionalProperties: false
        },
        annotations: CHANGE,
        run: (env, args) => applyProtocolAction(env, args.id, args.action, args)
    }
];

const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

const typeMatches = (type, value) => {
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    return typeof value === type;
};

// Checks the subset of JSON Schema these tools use and returns the first
// problem, so the model can correct its call.
const findArgumentError = (schema, value, path = 'arguments') => {
    if (!typeMatches(schema.type, value)) return `${path} must be of type ${schema.type}.`;
    if (schema.enum && !schema.enum.includes(value)) return `${path} must be one of: ${schema.enum.join(', ')}.`;
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) return `${path} must not be empty.`;
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) return `${path} has an invalid format.`;
    if (schema.minimum !== undefined && value < schema.minimum) return `${path} must be at least ${schema.minimum}.`;
    if (schema.maximum !== undefined && value > schema.maximum) return `${path} must be at most ${schema.maximum}.`;
    if (schema.type !== 'object') return null;

    const missing = (schema.required || []).find((key) => value[key] === undefined || value[key] === null);
    if (missing) return `${path}.${missing} is required.`;
    for (const [key, entry] of Object.entries(value)) {
        const property = schema.properties?.[key];
        if (!property) {
            if (schema.additionalProperties === false) return `${path}.${key} is not a recognized argument.`;
            continue;
        }
        // Models often send null for an optional argument they mean to omit.
        if (entry === undefined || entry === null) continue;
        const error = findArgumentError(property, entry, `${path}.${key}`);
        if (error) return error;
    }
    return null;
};

const toolResult = (payload, isError = false) => ({
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
    ...(isError ? { isError: true } : {})
});

const toolError = (code, message) => toolResult({ ok: false, error: { code, message } }, true);

class RpcError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const callTool = async (env, params) => {
    const tool = TOOLS_BY_NAME.get(params?.name);
    if (!tool) throw new RpcError(-32602, `Unknown tool: ${params?.name}`);
    const args = params.arguments ?? {};
    const argumentError = findArgumentError(tool.inputSchema, args);
    if (argumentError) return toolError('invalid_arguments', argumentError);
    try {
        return toolResult(await tool.run(env, args));
    } catch (error) {
        if (error instanceof HttpError) return toolError(error.code, error.message);
        return toolError('internal_error', 'LifeQuest encountered an unexpected error.');
    }
};

const negotiateVersion = (requested) => (
    SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0]
);

const dispatch = async (env, message) => {
    switch (message.method) {
        case 'initialize':
            return {
                protocolVersion: negotiateVersion(message.params?.protocolVersion),
                capabilities: { tools: { listChanged: false } },
                serverInfo: SERVER_INFO,
                instructions: INSTRUCTIONS
            };
        case 'ping':
            return {};
        case 'tools/list':
            return {
                tools: TOOLS.map(({ run: _run, ...definition }) => definition)
            };
        case 'tools/call':
            return callTool(env, message.params);
        default:
            throw new RpcError(-32601, `Method not found: ${message.method}`);
    }
};

const rpcResponse = (id, body, status = 200, headers = {}) => json(
    { jsonrpc: '2.0', id, ...body },
    status,
    crypto.randomUUID(),
    false,
    headers
);

const rpcError = (id, code, message, status = 200, headers = {}) => rpcResponse(
    id,
    { error: { code, message } },
    status,
    headers
);

const isRequestId = (id) => typeof id === 'string' || Number.isInteger(id);

export const handleMcpRequest = async (request, env) => {
    if (request.method !== 'POST') {
        // Stateless server: no server-initiated stream (GET) and no session to end (DELETE).
        return new Response(null, { status: 405, headers: { allow: 'POST' } });
    }

    const version = request.headers.get('mcp-protocol-version');
    if (version && !SUPPORTED_PROTOCOL_VERSIONS.includes(version)) {
        return rpcError(null, -32600, `Unsupported MCP protocol version: ${version}`, 400);
    }

    let message;
    try {
        message = await readJsonBody(request);
    } catch (error) {
        if (error.code === 'invalid_json') return rpcError(null, -32700, 'Parse error.', 400);
        return rpcError(null, -32600, error.message, error.status || 400);
    }

    if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0') {
        return rpcError(null, -32600, 'Expected a single JSON-RPC 2.0 message.', 400);
    }
    // Notifications and responses to server requests need no reply.
    if (!('method' in message) || !('id' in message)) {
        return new Response(null, { status: 202 });
    }
    if (!isRequestId(message.id)) {
        return rpcError(null, -32600, 'JSON-RPC request IDs must be strings or integers.', 400);
    }

    try {
        return rpcResponse(message.id, { result: await dispatch(env, message) });
    } catch (error) {
        if (error instanceof RpcError) return rpcError(message.id, error.code, error.message);
        return rpcError(message.id, -32603, 'Internal error.');
    }
};

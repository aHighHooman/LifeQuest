import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index.js';
import { SUPPORTED_PROTOCOL_VERSIONS } from './mcp.js';

const store = vi.hoisted(() => ({ snapshot: null, saves: 0 }));

vi.mock('./snapshotStore.js', () => ({
    loadSnapshot: async () => ({
        snapshot: structuredClone(store.snapshot),
        manifest: {},
        manifestUpdateTime: '2026-10-03T00:00:00.000Z'
    }),
    saveSnapshot: async (_env, _loaded, snapshot) => {
        store.snapshot = structuredClone(snapshot);
        store.saves += 1;
        return { revisionId: `revision-${store.saves}` };
    }
}));

const ENV = { LIFEQUEST_ACTION_TOKEN: 'correct', LIFEQUEST_TIME_ZONE: 'UTC' };

const makeSnapshot = () => ({
    formatVersion: 4,
    generatedAt: '2026-10-03T12:00:00.000Z',
    appName: 'LifeQuest',
    currencyUnitVersion: 2,
    stats: { level: 1, xp: 0, maxXp: 100, gold: 0 },
    settings: {
        protocolReward: 0.2,
        questRewards: { easy: 0.5, medium: 1.5, hard: 4, legendary: 10 }
    },
    quests: [{
        id: 'quest-1',
        title: 'Ship it',
        difficulty: 'medium',
        reward: { xp: 25, gold: 1.5 },
        completed: false,
        discarded: false,
        isFocusedToday: true
    }],
    habits: [{
        id: 'habit-1',
        title: 'Walk',
        frequency: 'daily',
        frequencyParam: 1,
        history: {},
        isActive: true,
        completionReward: 0.2,
        passiveReward: 0
    }],
    calories: { target: 2000, history: [] },
    coinHistory: [],
    budget: { earnedRewards: 0, goldToUsdRatio: 1 }
});

const post = (body, { token = 'correct', headers = {} } = {}) => worker.fetch(new Request('https://worker.example/mcp', {
    method: 'POST',
    headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
}), ENV);

const rpc = async (method, params, id = 1) => (await post({ jsonrpc: '2.0', id, method, params })).json();

const callTool = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result;

beforeEach(() => {
    store.snapshot = makeSnapshot();
    store.saves = 0;
});

describe('LifeQuest MCP transport', () => {
    it('negotiates a supported protocol version and advertises tools with instructions', async () => {
        const response = await rpc('initialize', {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'test', version: '1' }
        });
        expect(response).toMatchObject({
            jsonrpc: '2.0',
            id: 1,
            result: {
                protocolVersion: '2025-06-18',
                capabilities: { tools: {} },
                serverInfo: { name: 'lifequest' }
            }
        });
        expect(response.result.instructions).toContain('requestId');
    });

    it('offers its newest protocol version when the requested one is unknown', async () => {
        const response = await rpc('initialize', { protocolVersion: '1999-01-01', capabilities: {} });
        expect(response.result.protocolVersion).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
    });

    it('rejects requests that declare an unsupported protocol version header', async () => {
        const response = await post(
            { jsonrpc: '2.0', id: 1, method: 'ping' },
            { headers: { 'mcp-protocol-version': '1999-01-01' } }
        );
        expect(response.status).toBe(400);
    });

    it('requires the bearer token and tells the client how to authenticate', async () => {
        const response = await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { token: 'wrong' });
        expect(response.status).toBe(401);
        expect(response.headers.get('www-authenticate')).toContain('Bearer');
        expect(store.saves).toBe(0);
    });

    it('fails closed when the token is not configured', async () => {
        const response = await worker.fetch(new Request('https://worker.example/mcp', {
            method: 'POST',
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
        }), {});
        expect(response.status).toBe(500);
    });

    it('does not offer a server-sent event stream', async () => {
        const response = await worker.fetch(new Request('https://worker.example/mcp'), ENV);
        expect(response.status).toBe(405);
        expect(response.headers.get('allow')).toBe('POST');
    });

    it('accepts notifications without a reply body', async () => {
        const response = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
        expect(response.status).toBe(202);
    });

    it('reports JSON-RPC parse, request, and method errors', async () => {
        await expect((await post('{nope')).json()).resolves.toMatchObject({ error: { code: -32700 } });
        await expect((await post([{ jsonrpc: '2.0', id: 1, method: 'ping' }])).json())
            .resolves.toMatchObject({ error: { code: -32600 } });
        await expect(rpc('resources/list')).resolves.toMatchObject({ id: 1, error: { code: -32601 } });
        await expect(rpc('tools/call', { name: 'delete_everything' })).resolves.toMatchObject({ error: { code: -32602 } });
    });
});

describe('LifeQuest MCP tools', () => {
    it('lists the tools without exposing their handlers', async () => {
        const { result } = await rpc('tools/list');
        expect(result.tools.map((tool) => tool.name)).toEqual([
            'get_today',
            'list_quests',
            'list_protocols',
            'create_quest',
            'update_quest_status',
            'create_protocol',
            'update_protocol_status'
        ]);
        result.tools.forEach((tool) => {
            expect(tool.run).toBeUndefined();
            expect(tool.inputSchema.type).toBe('object');
            expect(tool.annotations).toBeDefined();
        });
    });

    it('reads today without saving', async () => {
        const result = await callTool('get_today', {});
        expect(result.isError).toBeUndefined();
        expect(result.structuredContent.dashboard.quests.map((quest) => quest.id)).toEqual(['quest-1']);
        expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
        expect(store.saves).toBe(0);
    });

    it('filters list arguments the same way as the REST query string', async () => {
        const result = await callTool('list_quests', { status: 'all', query: 'ship', limit: 5 });
        expect(result.structuredContent).toMatchObject({ status: 'all', count: 1 });
    });

    it('returns argument problems as tool errors the model can correct', async () => {
        const badAction = await callTool('update_quest_status', { id: 'quest-1', action: 'finish' });
        expect(badAction.isError).toBe(true);
        expect(badAction.structuredContent.error).toMatchObject({ code: 'invalid_arguments' });
        expect(badAction.structuredContent.error.message).toContain('complete');

        const unknownField = await callTool('create_quest', { title: 'x', priority: 'high' });
        expect(unknownField.structuredContent.error.message).toContain('priority');

        const badDate = await callTool('create_quest', { title: 'x', dueDate: 'next friday' });
        expect(badDate.isError).toBe(true);
        expect(store.saves).toBe(0);
    });

    it('treats null optional arguments as omitted', async () => {
        const result = await callTool('create_quest', { title: 'Call mom', dueDate: null, reward: null });
        expect(result.isError).toBeUndefined();
        expect(result.structuredContent.quest).toMatchObject({ title: 'Call mom', dueDate: null });
    });

    it('creates a quest once per requestId', async () => {
        const args = { requestId: 'req-1', title: 'Buy gift', difficulty: 'easy', dueDate: '2026-10-10' };
        const first = await callTool('create_quest', args);
        const retry = await callTool('create_quest', args);
        expect(first.structuredContent).toMatchObject({ ok: true, quest: { title: 'Buy gift', dueDate: '2026-10-10' } });
        expect(retry.structuredContent.quest.id).toBe(first.structuredContent.quest.id);
        expect(store.snapshot.quests.filter((quest) => quest.title === 'Buy gift')).toHaveLength(1);
    });

    it('completes and undoes a quest through the shared domain rules', async () => {
        const completed = await callTool('update_quest_status', { id: 'quest-1', action: 'complete' });
        expect(completed.structuredContent).toMatchObject({ ok: true, changed: true, quest: { status: 'completed' } });
        expect(store.snapshot.stats.gold).toBe(1.5);

        const undone = await callTool('update_quest_status', { id: 'quest-1', action: 'undo' });
        expect(undone.structuredContent.quest.status).toBe('active');
        expect(store.snapshot.stats.gold).toBe(0);
    });

    it('creates and completes a protocol', async () => {
        const created = await callTool('create_protocol', {
            requestId: 'req-p', title: 'Stretch', frequency: 'interval', frequencyParam: 3, active: true
        });
        expect(created.structuredContent.protocol).toMatchObject({ title: 'Stretch', frequency: 'interval', frequencyParam: 3 });

        const completed = await callTool('update_protocol_status', {
            id: 'habit-1', action: 'complete', requestId: 'req-c'
        });
        expect(completed.structuredContent.protocol).toMatchObject({ completedToday: true });
        const retried = await callTool('update_protocol_status', {
            id: 'habit-1', action: 'complete', requestId: 'req-c'
        });
        expect(retried.structuredContent.changed).toBe(false);
    });

    it('returns domain failures as tool errors', async () => {
        const result = await callTool('update_quest_status', { id: 'missing', action: 'complete' });
        expect(result.isError).toBe(true);
        expect(result.structuredContent.error.code).toBe('quest_not_found');
    });
});

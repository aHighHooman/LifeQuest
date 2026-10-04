# LifeQuest Action API

This Cloudflare Worker exposes the existing Firebase-backed LifeQuest account to
AI assistants in two ways: an MCP server at `/mcp`, and the compact REST
operations used by the private Custom GPT. Both call the same operations in
`src/operations.js`. The Custom GPT is being retired in favor of MCP.

It is deliberately a bridge, not a second database:

```text
MCP client / Custom GPT -> Cloudflare Worker -> Firebase Auth REST -> Firestore REST
```

The Worker uses the existing dedicated LLM Firebase account. Its credentials are
stored as encrypted Cloudflare secrets and are never sent to ChatGPT.

The Action currently writes LifeQuest snapshot format v4 with currency unit
version 2. It also migrates the earlier v1–v3 whole-unit snapshots in memory
before serving reads or saving a mutation. Future snapshot formats are rejected
until their data rules are implemented explicitly.

## Implemented operations

Reads:

- `GET /v1/today`
- `GET /v1/dashboard`
- `GET /v1/quests`
- `GET /v1/protocols`

Quest mutations:

- `POST /v1/quests`
- `POST /v1/quests/{id}/complete`
- `POST /v1/quests/{id}/undo`
- `POST /v1/quests/{id}/discard`
- `POST /v1/quests/{id}/restore`
- `POST /v1/quests/{id}/select-for-today`
- `POST /v1/quests/{id}/remove-from-today`

Protocol mutations:

- `POST /v1/protocols`
- `POST /v1/protocols/{id}/complete`
- `POST /v1/protocols/{id}/skip`
- `POST /v1/protocols/{id}/activate`
- `POST /v1/protocols/{id}/deactivate`

The deployed Worker serves its Custom GPT schema at `/openapi.json`.

## Local setup without a Cloudflare account

1. Copy `worker/.dev.vars.example` to `worker/.dev.vars`.
2. Fill in the six local values. Do not commit this file.
3. Run `npm run action:dev`.
4. Test `http://localhost:8787/health`.

All `/v1/*` routes require:

```text
Authorization: Bearer <LIFEQUEST_ACTION_TOKEN>
```

## One-time Cloudflare account handoff

The account owner must create a free Cloudflare account and complete its email,
terms, and browser-verification flow. A Worker does not need to be created in the
dashboard.

After the account exists:

```powershell
npx wrangler login
```

The browser authorization is the only unavoidable account step. After it
succeeds, Codex can run the remaining commands.

Set each production secret through Wrangler's protected prompt:

```powershell
npx wrangler secret put LIFEQUEST_ACTION_TOKEN --config worker/wrangler.jsonc
npx wrangler secret put FIREBASE_API_KEY --config worker/wrangler.jsonc
npx wrangler secret put FIREBASE_LLM_EMAIL --config worker/wrangler.jsonc
npx wrangler secret put FIREBASE_LLM_PASSWORD --config worker/wrangler.jsonc
npx wrangler secret put FIREBASE_PROJECT_ID --config worker/wrangler.jsonc
npx wrangler secret put LIFEQUEST_OWNER_UID --config worker/wrangler.jsonc
```

Do not put secret values directly on a command line or in committed files.

`FIREBASE_PROJECT_ID` and `LIFEQUEST_OWNER_UID` are identifiers rather than
credentials, but they are kept out of `wrangler.jsonc` so the repository holds
no account metadata. A Worker that previously had them as plain-text `vars`
must be deployed without them before `wrangler secret put` accepts those names.

Deploy:

```powershell
npm run action:deploy
```

Wrangler creates `lifequest-action-api` during the first deployment and returns
its `workers.dev` URL. Verify:

```text
https://<worker-url>/health
https://<worker-url>/openapi.json
```

## MCP server

`POST /mcp` is a stateless MCP endpoint (Streamable HTTP transport, JSON
responses, protocol versions 2025-03-26 through 2025-11-25). It requires the
same `Authorization: Bearer <LIFEQUEST_ACTION_TOKEN>` header as the REST routes.

Tools:

| Tool | Purpose |
| --- | --- |
| `get_today` | Dashboard and what remains today |
| `list_quests` | List or search quests by status and title |
| `list_protocols` | List or search protocols |
| `create_quest` | Create a quest (idempotent with `requestId`) |
| `update_quest_status` | `complete`, `undo`, `discard`, `restore`, `select-for-today`, `remove-from-today` |
| `create_protocol` | Create a protocol (idempotent with `requestId`) |
| `update_protocol_status` | `complete`, `skip`, `activate`, `deactivate` |

The server sends its usage rules as MCP `instructions` during initialization,
so clients do not need a separate instructions file.

Connect Claude Code, keeping the token in an environment variable rather than
typing it into the command:

```powershell
claude mcp add --transport http lifequest https://<worker-url>/mcp --header "Authorization: Bearer $env:LIFEQUEST_ACTION_TOKEN"
```

Locally, `npm run action:dev` serves the same endpoint at
`http://localhost:8787/mcp`.

Clients that only accept OAuth for remote servers, such as claude.ai custom
connectors and ChatGPT connectors, cannot use the bearer token yet.

## Custom GPT configuration

1. Create a private GPT in the ChatGPT web editor.
2. Copy the contents of `worker/GPT_INSTRUCTIONS.md` into Instructions.
3. Add a Custom Action by importing the deployed `/openapi.json` URL.
4. Select API key authentication using Bearer auth.
5. Enter the same value used for `LIFEQUEST_ACTION_TOKEN`.
6. Test reads and mutations in Preview.
7. Keep sharing set to invite-only/private.

No Firebase password is entered into ChatGPT.

## Security model

- The Action token protects the public Worker endpoint.
- The Worker authenticates internally as the allowlisted Firebase LLM UID.
- The owner UID is fixed by a Worker secret; callers cannot choose another UID.
- Firestore writes use the current manifest update time as a precondition.
- Snapshot checksums and chunk ordering are verified before state is used.
- Permanent deletion is intentionally not exposed.
- API responses and Worker error responses do not contain secrets.

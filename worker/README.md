# LifeQuest MCP Worker

This Cloudflare Worker exposes the existing Firebase-backed LifeQuest account to
AI assistants as an MCP server at `/mcp`. Every tool runs through the shared
operations in `src/operations.js`, which apply the same `src/domain` rules as
the app.

It is deliberately a bridge, not a second database:

```text
MCP client -> Cloudflare Worker -> Firebase Auth REST -> Firestore REST
```

The Worker uses the existing dedicated LLM Firebase account. Its credentials are
stored as encrypted Cloudflare secrets and are never sent to an assistant.

The Worker currently writes LifeQuest snapshot format v4 with currency unit
version 2. It also migrates the earlier v1–v3 whole-unit snapshots in memory
before serving reads or saving a mutation. Future snapshot formats are rejected
until their data rules are implemented explicitly.

## Routes

- `GET /health`: public liveness check
- `GET /privacy`: public privacy policy
- `POST /mcp`: the MCP server; requires `Authorization: Bearer <LIFEQUEST_ACTION_TOKEN>`

## MCP server

`/mcp` is a stateless MCP endpoint (Streamable HTTP transport, JSON responses,
protocol versions 2025-03-26 through 2025-11-25).

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

Connect Claude Code, loading the locally encrypted token into the session
rather than typing it:

```powershell
$env:LIFEQUEST_ACTION_TOKEN = [System.Net.NetworkCredential]::new('', (Import-Clixml worker/.secrets/action-token.clixml)).Password
claude mcp add --transport http --scope user lifequest https://<worker-url>/mcp --header "Authorization: Bearer $env:LIFEQUEST_ACTION_TOKEN"
```

Clients that only accept OAuth for remote servers, such as claude.ai custom
connectors and ChatGPT connectors, cannot use the bearer token yet.

## Local setup

1. Copy `worker/.dev.vars.example` to `worker/.dev.vars`.
2. Fill in the six local values. Do not commit this file.
3. Run `npm run action:dev`.
4. Test `http://localhost:8787/health`; the MCP endpoint is
   `http://localhost:8787/mcp`.

## Cloudflare setup

Authorize Wrangler once in the browser:

```powershell
npx wrangler login
```

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
no account metadata.

Deploy, then check `https://<worker-url>/health`:

```powershell
npm run action:deploy
```

## Token handling

- `scripts/provision-action-token.ps1` generates a new token, uploads it as the
  `LIFEQUEST_ACTION_TOKEN` secret, and stores a copy in
  `worker/.secrets/action-token.clixml`, encrypted for the current Windows user.
  Connected clients must be updated with the new token afterwards.
- `scripts/copy-action-token.ps1` copies the stored token to the clipboard.

## Security model

- The bearer token protects the public `/mcp` endpoint.
- The Worker authenticates internally as the allowlisted Firebase LLM UID.
- The owner UID is fixed by a Worker secret; callers cannot choose another UID.
- Firestore writes use the current manifest update time as a precondition.
- Snapshot checksums and chunk ordering are verified before state is used.
- Permanent deletion is intentionally not exposed.
- Tool results and Worker error responses do not contain secrets.

# LifeQuest Action API

This Cloudflare Worker exposes the existing Firebase-backed LifeQuest account to
a private Custom GPT through compact authenticated REST operations.

It is deliberately a bridge, not a second database:

```text
Custom GPT -> Cloudflare Worker -> Firebase Auth REST -> Firestore REST
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
2. Fill in the four local values. Do not commit this file.
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
```

Do not put secret values directly on a command line or in committed files.

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
- The owner UID is fixed in `wrangler.jsonc`; callers cannot choose another UID.
- Firestore writes use the current manifest update time as a precondition.
- Snapshot checksums and chunk ordering are verified before state is used.
- Permanent deletion is intentionally not exposed.
- API responses and Worker error responses do not contain secrets.

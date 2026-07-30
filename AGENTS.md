# LifeQuest Agent Rules

These instructions apply to every agent working anywhere in this repository.

## Product and design intent

LifeQuest should feel like a physical place and a collection of tangible objects, not a transparent HUD floating over interchangeable screens.

- Preserve object permanence. An object may leave because it moves beyond the viewport, becomes physically occluded, or is explicitly removed by the user. It must not fade away merely to make a transition convenient.
- Dashboard, Quests, Protocols, and related surfaces should feel spatially connected and anchored in the same world.
- Do not use crossfades, dissolves, opacity swaps, transparent overlays, or unrelated endpoint images to imitate physical camera movement unless the user explicitly requests that treatment.
- Prefer one continuous scene, shared coordinate system, and synchronized spatial transforms. Backgrounds and interactive content that represent the same physical surface should move together.
- Treat motion references literally. If a reference animation pans or turns without fading, the implementation must not introduce fading.
- Navigation must never depend on network-loaded media, video playback, decoding readiness, or cloud availability. Prefer compositor-friendly `transform` motion over layout-triggering properties.
- Reduced-motion support may shorten or remove movement, but it must preserve the final spatial relationship.

Before completing visual work, inspect the transition at its start, midpoint, and end in both directions. Verify object continuity rather than checking only the destination screen.

## Scope and shared-worktree discipline

This workspace may contain changes from other tasks or agents. Dirty files are not authorization.

- Commit only files and hunks that clearly belong to the user’s current request.
- If unrelated work is present, leave it untouched. Use partial staging when tasks share a file.
- Never infer that an unfamiliar directory, service, worker, dependency change, or cloud configuration belongs to the task merely because it is uncommitted.
- If the user refers to another completed task and its ownership is ambiguous, inspect its purpose and ask before committing or pushing it.
- Do not commit or push unless the user explicitly asks. A request to push one task does not authorize publishing other dirty work.

## Cloud, authentication, and privacy

Treat all cloud and account metadata as sensitive by default, including values that are identifiers rather than credentials.

- Do not commit or publish real email addresses, user IDs, Firebase UIDs, project IDs, tenant IDs, account names, deployment URLs, Worker names, database paths, or allowlists unless they are required for the requested task and the user explicitly approves publishing them.
- Never commit passwords, API keys, bearer tokens, private keys, service-account files, `.env` files, `.dev.vars`, Wrangler state, encrypted credential exports, password markers, or files under a secrets directory.
- Example configuration must contain obvious placeholders only. Scripts must read identity and account values from environment variables or protected prompts rather than hardcoding real values.
- Cloudflare, Firebase, GitHub, email, and other external-service work is out of scope unless the user explicitly places that service in scope.
- Do not deploy, change cloud configuration, rotate credentials, alter access rules, or expose an endpoint as a side effect of unrelated application work.

Before every commit that touches cloud, authentication, deployment, or configuration:

1. Review `git diff --cached --name-only`.
2. Review the complete staged diff.
3. Search staged content for emails, UIDs, project IDs, URLs, tokens, keys, passwords, and private-key headers.
4. Confirm local credential artifacts are ignored and absent from the index.
5. State exactly which cloud-related files will be published before pushing.

If sensitive material is committed, stop. Do not rely on a revert alone because the value remains in history. Determine whether history rewriting and credential rotation are required, and tell the user exactly what was exposed.

## Git safety

- Fetch before pushing and verify the intended branch and remote.
- Prefer separate commits for separate tasks.
- Never force-push ordinary feature work.
- For an explicitly authorized history sanitation, create a local backup reference first and use `--force-with-lease`, never an unconditional force push.
- After pushing, verify the local branch matches the remote and that the worktree contains no unintended uncommitted files.

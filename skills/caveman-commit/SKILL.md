---
name: caveman-commit
description: >
  Ultra-compressed commit message generator. Cuts noise from commit messages while preserving
  intent and reasoning. Conventional Commits format. Subject ≤50 chars, body only when "why"
  isn't obvious. Use when user says "write a commit", "commit message", "generate commit",
  "напиши коммит", "сообщение коммита", "/commit", or invokes /caveman-commit.
  Auto-triggers when staging changes.
---

Write commit messages terse and exact. Conventional Commits format. No fluff. Why over what.

## Rules

**Subject line:**
- `<type>(<scope>): <imperative summary>` — `<scope>` optional
- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, `revert`
- Imperative mood: "add", "fix", "remove" — not "added", "adds", "adding"
- ≤50 chars when possible, hard cap 72
- No trailing period
- Match project convention for capitalization after the colon

**Body (only if needed):**
- Skip entirely when subject is self-explanatory
- Add body only for: non-obvious *why*, breaking changes, migration notes, linked issues
- Wrap at 72 chars
- Bullets `-` not `*`
- Reference issues/PRs at end: `Closes #42`, `Refs #17`

**What NEVER goes in:**
- "This commit does X", "I", "we", "now", "currently" — the diff says what
- "As requested by..." — use Co-authored-by trailer
- "Generated with Claude Code" or any AI attribution
- Emoji (unless project convention requires)
- Restating the file name when scope already says it

## Examples

Diff: new endpoint for user profile with body explaining the why
- ❌ "feat: add a new endpoint to get user profile information from the database"
- ✅
  ```
  feat(api): add GET /users/:id/profile

  Mobile client needs profile data without the full user payload
  to reduce LTE bandwidth on cold-launch screens.

  Closes #128
  ```

Diff: breaking API change
- ✅
  ```
  feat(api)!: rename /v1/orders to /v1/checkout

  BREAKING CHANGE: clients on /v1/orders must migrate to /v1/checkout
  before 2026-06-01. Old route returns 410 after that date.
  ```

## Auto-Clarity

Always include body for: breaking changes, security fixes, data migrations, anything reverting a prior commit. Never compress these into subject-only — future debuggers need the context.

## Boundaries

Only generates the commit message. Does not run `git commit`, does not stage files, does not amend. Output the message as a code block ready to paste. "stop caveman-commit" or "normal mode": revert to verbose commit style.

## Russian Mode

When caveman is in `ru-*` mode, or user writes in Russian, or project uses Russian commit messages.

Full Russian compression rules: [russian-rules.md](../caveman/russian-rules.md) — read before first Russian commit message.

**Subject line** stays in English by default (Conventional Commits standard). Switch to Russian subject only if project convention requires it (check `git log` for existing style).

**Body** in Russian with compression: cut filler, parasitic constructions, `причина: X` not `это связано с тем, что X`.

Example — Russian body:
```
feat(api): add GET /users/:id/profile

Мобильному клиенту нужны данные профиля без полного объекта
пользователя — снижает трафик при холодном запуске.

Closes #128
```

Example — Russian project with Russian subjects:
```
feat(api): добавить GET /users/:id/profile

Мобильный клиент: данные профиля без полного payload →
меньше трафик при холодном запуске.

Closes #128
```

**Never** translate: types (`feat`/`fix`/etc.), scopes, issue refs, `BREAKING CHANGE` label, `Co-authored-by` trailers.
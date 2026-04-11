# Changelog

## Unreleased

### Added
- **Russian Caveman** — full Russian-language mode (`caveman-ru` skill) with
  four intensity levels:
  - `ru-lite` — soft compression, mostly full sentences, suitable for
    user-facing text and docs.
  - `ru-full` — default. Short phrases, drop pronouns and filler, fragments OK.
    Targets code review, debug summaries, technical explanations.
  - `ru-ultra` — telegraphic style with arrows, colons, bullets. Targets
    agent-to-agent answers and summaries.
  - `ru-notes` — maximum compression, conspect-style notes for self or another
    agent.
- `skills/caveman-ru/SKILL.md` — source-of-truth skill file with rules,
  examples, auto-clarity, invariants.
- `skills/caveman-ru/abbreviations.md` — whitelist of allowed Russian
  abbreviations (`т.к.`, `т.е.`, `и т.д.`, `кол-во`, `к-рый`, `ЧТД`, etc.).
- `skills/caveman-ru/README.ru.md` — Russian-language README with before/after,
  level guide, when-not-to-use section.
- `rules/caveman-ru-activate.md` — Russian always-on activation rule body.
- `commands/caveman-ru.toml` — Russian slash command.
- `evals/prompts/ru.txt` — 10 Russian eval prompts mirroring `en.txt`.
- `tests/corpus-ru/` — benchmark corpus of 10 cases × 5 levels (baseline +
  four compressed modes) covering bug explanations, debug summaries,
  comparisons, code review comments, shell instructions, JSON responses,
  and agent notes.
- `tests/test_caveman_ru.py` — test suite validating asset presence, corpus
  shape, monotonic compression across levels, identifier preservation,
  hook mode tracking for `/caveman ru*` and `/caveman-ru`, and Russian
  deactivation phrases.

### Changed
- `hooks/caveman-mode-tracker.js` now recognizes `/caveman ru`,
  `/caveman ru-lite`, `/caveman ru-full`, `/caveman ru-ultra`,
  `/caveman ru-notes`, and the `/caveman-ru` command. Also detects Russian
  deactivation phrases (`обычный режим`, `нормальный режим`,
  `выключи пещерный`, `стоп пещерный`, `выключи caveman`).
- `README.md` now includes a Russian Mode section with before/after examples,
  level table, invariants list, and "when not to use ultra/notes" guidance.

### Language selection (follow-up)

Three ways to pick the language beyond per-turn `/caveman ru`:

- **A. Default language via settings.** `hooks/caveman-activate.js` now reads
  `caveman.lang` from `~/.claude/settings.json` (or `CAVEMAN_LANG` env var,
  which takes precedence). When set to `ru`, the SessionStart hook seeds the
  flag with `ru-full` and injects Russian caveman rules instead of English.
  Malformed settings and unknown values fall back to English silently.
- **B. Auto-detect by prompt language** (opt-in via
  `caveman.autoDetectLanguage: true` or `CAVEMAN_AUTO_DETECT_LANG=1`).
  `hooks/caveman-mode-tracker.js` strips code fences / inline backticks,
  then checks the Cyrillic-letter ratio of the remaining prose. ≥30% flips
  `full`/`lite`/`ultra` → `ru-full`/`ru-lite`/`ru-ultra`; ≤5% flips back.
  Prompts shorter than 15 prose characters are ignored so `ok`, `да`, `LGTM`
  don't thrash the mode. Explicit `/caveman` commands always override
  auto-detect. `ru-notes` has no English equivalent and maps back to `full`
  when the user switches to English.
- **C. Russian rule sync for other agents.** `.github/workflows/sync-skill.yml`
  now copies `skills/caveman-ru/SKILL.md` + `abbreviations.md` to
  `plugins/caveman/skills/caveman-ru/`, `.cursor/skills/caveman-ru/`,
  `.windsurf/skills/caveman-ru/`, builds `caveman-ru.skill` zip, and
  generates rule files from `rules/caveman-ru-activate.md`:
  - `.clinerules/caveman-ru.md` — direct copy (Cline auto-loads all rule
    files; English and Russian coexist, model chooses based on prompt
    language).
  - `.cursor/rules/caveman-ru.mdc` — `alwaysApply: false` with an
    agent-requested description. English stays always-on; users opt into
    Russian by describing their need or flipping the flag.
  - `.windsurf/rules/caveman-ru.md` — `trigger: model_decision` with a
    description, same rationale.
  - `.github/copilot-instructions.md` / `AGENTS.md` — deliberately
    **not** touched. Those are single repo-wide instruction files; keeping
    them English-only avoids mixed-language repo instructions. Russian
    Copilot users should set `caveman.lang: ru` locally or reference the
    `skills/caveman-ru/` files directly.

All synced Russian files are committed alongside this change so the branch
ships a complete install surface — not just a promise that CI will sync
them on merge.

### Tests added for A/B/C

`tests/test_caveman_ru.py` now also covers:

- SessionStart language selection: default English, settings-driven Russian,
  env-var override, invalid lang → fallback, malformed settings → silent
  fallback.
- Auto-detect: Russian→`ru-*` positive cases for full/lite/ultra, English
  reverse cases, disabled-by-default, enabled-via-env, Cyrillic-in-
  backticks-ignored, short-prompt-ignored, explicit-command-overrides,
  `ru-notes` → `full` bounce-back.

`tests/verify_repo.py` now verifies all Russian synced copies,
`caveman-ru.skill` zip contents, and that Cursor/Windsurf Russian rule
files carry the opt-in frontmatter.

### Design rationale

Russian text compresses differently from English. Russian is typically longer
in tokens because of longer word forms, more function words, and heavier
syntactic structures. The Russian mode therefore:

- prioritizes comprehensibility > brevity > technical accuracy > aesthetics
  (in that order);
- treats code, URLs, paths, API names, JSON/YAML/SQL, stack traces, and error
  quotes as invariants that are never touched;
- uses only a whitelist of well-known Russian abbreviations; never invents
  new ones on the fly;
- supports structural templates (`причина → эффект`,
  `симптом → диагноз → фикс`, `было / стало`) over prose rewriting;
- includes an Auto-Clarity rule that drops caveman for security warnings,
  irreversible operations, and confused users, then resumes.

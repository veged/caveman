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

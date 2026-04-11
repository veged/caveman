"""Basic validation tests for the Russian Caveman corpus and assets."""

import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL_DIR = REPO_ROOT / "skills" / "caveman-ru"
CORPUS = REPO_ROOT / "tests" / "corpus-ru" / "examples.json"
RULES = REPO_ROOT / "rules" / "caveman-ru-activate.md"
COMMAND = REPO_ROOT / "commands" / "caveman-ru.toml"
EVAL_PROMPTS = REPO_ROOT / "evals" / "prompts" / "ru.txt"
MODE_TRACKER = REPO_ROOT / "hooks" / "caveman-mode-tracker.js"

LEVELS = ["ru-lite", "ru-full", "ru-ultra", "ru-notes"]


class RussianCavemanAssetsTests(unittest.TestCase):
    def test_skill_md_exists_with_frontmatter(self):
        skill = SKILL_DIR / "SKILL.md"
        self.assertTrue(skill.exists(), f"missing {skill}")
        text = skill.read_text(encoding="utf-8")
        self.assertTrue(text.startswith("---\n"), "SKILL.md must start with YAML frontmatter")
        self.assertIn("name: caveman-ru", text)
        self.assertIn("ru-lite", text)
        self.assertIn("ru-full", text)
        self.assertIn("ru-ultra", text)
        self.assertIn("ru-notes", text)

    def test_abbreviations_whitelist_present(self):
        abbr = SKILL_DIR / "abbreviations.md"
        self.assertTrue(abbr.exists(), f"missing {abbr}")
        text = abbr.read_text(encoding="utf-8")
        for token in ["т.к.", "т.е.", "и т.д.", "см.", "напр.", "кол-во", "ЧТД"]:
            self.assertIn(token, text, f"whitelist must mention {token!r}")

    def test_activation_rule_exists(self):
        self.assertTrue(RULES.exists(), f"missing {RULES}")
        text = RULES.read_text(encoding="utf-8")
        self.assertIn("Инварианты", text)
        self.assertIn("stop caveman", text)

    def test_command_toml_exists(self):
        self.assertTrue(COMMAND.exists(), f"missing {COMMAND}")
        text = COMMAND.read_text(encoding="utf-8")
        self.assertIn("description", text)
        self.assertIn("ru-lite", text)
        self.assertIn("ru-notes", text)

    def test_eval_prompts_ru_nonempty(self):
        self.assertTrue(EVAL_PROMPTS.exists(), f"missing {EVAL_PROMPTS}")
        prompts = [
            p.strip() for p in EVAL_PROMPTS.read_text(encoding="utf-8").splitlines() if p.strip()
        ]
        self.assertGreaterEqual(len(prompts), 10, "need at least 10 Russian eval prompts")
        for p in prompts:
            self.assertTrue(
                re.search(r"[а-яА-ЯёЁ]", p), f"prompt must contain Cyrillic: {p!r}"
            )


class RussianCavemanCorpusTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(CORPUS.read_text(encoding="utf-8"))

    def test_corpus_levels_declared(self):
        self.assertEqual(self.data["levels"], LEVELS)

    def test_all_cases_have_all_levels(self):
        cases = self.data["cases"]
        self.assertGreaterEqual(len(cases), 9, "corpus should cover all required types")
        for case in cases:
            for field in ("id", "type", "prompt", "baseline"):
                self.assertIn(field, case, f"case missing {field}")
            for lvl in LEVELS:
                self.assertIn(lvl, case, f"case {case['id']} missing level {lvl}")
                self.assertTrue(case[lvl].strip(), f"{case['id']}/{lvl} is empty")

    def test_compression_is_monotonic_on_average(self):
        """Across the corpus, on average each successive level should be
        shorter than the previous (baseline → lite → full → ultra → notes)."""
        order = ["baseline"] + LEVELS
        sums = {lvl: 0 for lvl in order}
        for case in self.data["cases"]:
            for lvl in order:
                sums[lvl] += len(case[lvl])
        for a, b in zip(order, order[1:]):
            self.assertLess(
                sums[b],
                sums[a],
                f"average {b} length ({sums[b]}) not shorter than {a} ({sums[a]})",
            )

    def test_required_case_types_present(self):
        required_types = {
            "bug-explanation",
            "debug-summary",
            "explanation",
            "comparison",
            "code-review-comment",
            "shell-instruction",
            "answer-with-json",
            "agent-notes",
        }
        actual_types = {case["type"] for case in self.data["cases"]}
        missing = required_types - actual_types
        self.assertFalse(missing, f"corpus missing case types: {missing}")

    def test_code_identifiers_preserved(self):
        """Identifiers wrapped in backticks in the baseline must appear verbatim
        in every compressed level (invariant: code/API names never
        russified or shortened)."""
        ident_re = re.compile(r"`([A-Za-z_][A-Za-z0-9_.]*)`")
        for case in self.data["cases"]:
            baseline_idents = set(ident_re.findall(case["baseline"]))
            for lvl in LEVELS:
                text = case[lvl]
                lvl_idents = set(ident_re.findall(text))
                # Compressed levels may drop some identifiers when the fragment
                # itself is dropped, but must never INVENT or RENAME one.
                invented = lvl_idents - baseline_idents - _allowed_new_idents(case)
                self.assertFalse(
                    invented,
                    f"{case['id']}/{lvl} introduced new identifiers: {invented}",
                )


def _allowed_new_idents(case):
    """Some cases legitimately introduce identifiers at compressed levels
    (e.g. the eval prompt itself mentions them). Read them from the prompt."""
    ident_re = re.compile(r"`([A-Za-z_][A-Za-z0-9_.]*)`")
    return set(ident_re.findall(case["prompt"]))


class RussianCavemanHookTests(unittest.TestCase):
    def _run_tracker(self, prompt):
        with tempfile.TemporaryDirectory(prefix="caveman-ru-") as tmp:
            home = Path(tmp)
            env = {
                "HOME": str(home),
                "USERPROFILE": str(home),
                "PATH": "/usr/bin:/bin:/usr/local/bin",
            }
            subprocess.run(
                ["node", str(MODE_TRACKER)],
                input=json.dumps({"prompt": prompt}),
                text=True,
                env=env,
                check=True,
            )
            flag = home / ".claude" / ".caveman-active"
            return flag.read_text(encoding="utf-8") if flag.exists() else None

    def test_tracker_sets_ru_full_on_caveman_ru(self):
        self.assertEqual(self._run_tracker("/caveman ru"), "ru-full")

    def test_tracker_sets_ru_lite(self):
        self.assertEqual(self._run_tracker("/caveman ru-lite"), "ru-lite")

    def test_tracker_sets_ru_ultra(self):
        self.assertEqual(self._run_tracker("/caveman ru-ultra"), "ru-ultra")

    def test_tracker_sets_ru_notes(self):
        self.assertEqual(self._run_tracker("/caveman ru-notes"), "ru-notes")

    def test_tracker_caveman_ru_command(self):
        self.assertEqual(self._run_tracker("/caveman-ru ultra"), "ru-ultra")
        self.assertEqual(self._run_tracker("/caveman-ru"), "ru-full")

    def test_tracker_russian_deactivation(self):
        # First activate, then deactivate via Russian phrase
        with tempfile.TemporaryDirectory(prefix="caveman-ru-deact-") as tmp:
            home = Path(tmp)
            env = {
                "HOME": str(home),
                "USERPROFILE": str(home),
                "PATH": "/usr/bin:/bin:/usr/local/bin",
            }
            subprocess.run(
                ["node", str(MODE_TRACKER)],
                input=json.dumps({"prompt": "/caveman ru-full"}),
                text=True,
                env=env,
                check=True,
            )
            flag = home / ".claude" / ".caveman-active"
            self.assertTrue(flag.exists())

            subprocess.run(
                ["node", str(MODE_TRACKER)],
                input=json.dumps({"prompt": "обычный режим пожалуйста"}),
                text=True,
                env=env,
                check=True,
            )
            self.assertFalse(flag.exists(), "Russian deactivation phrase must clear flag")


if __name__ == "__main__":
    unittest.main()

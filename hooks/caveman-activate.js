#!/usr/bin/env node
// caveman — Claude Code SessionStart activation hook
//
// Runs on every session start:
//   1. Resolves default language (env CAVEMAN_LANG, settings.json `caveman.lang`, else "en")
//   2. Writes flag file at ~/.claude/.caveman-active (statusline reads this)
//   3. Emits the language-appropriate caveman ruleset as hidden SessionStart context
//   4. Detects missing statusline config and emits setup nudge

const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeDir = path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.caveman-active');
const settingsPath = path.join(claudeDir, 'settings.json');

// --- 1. Resolve default language ----------------------------------------
// Priority: env CAVEMAN_LANG > settings.json caveman.lang > "en"
function resolveDefaultLang() {
  const envLang = (process.env.CAVEMAN_LANG || '').trim().toLowerCase();
  if (envLang === 'ru' || envLang === 'en') return envLang;

  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const cfg = settings && settings.caveman;
      if (cfg && typeof cfg.lang === 'string') {
        const lang = cfg.lang.trim().toLowerCase();
        if (lang === 'ru' || lang === 'en') return lang;
      }
    }
  } catch (e) {
    // Silent fail — invalid settings shouldn't block session start
  }
  return 'en';
}

const defaultLang = resolveDefaultLang();
const defaultMode = defaultLang === 'ru' ? 'ru-full' : 'full';

// --- 2. Write flag file --------------------------------------------------
try {
  fs.mkdirSync(path.dirname(flagPath), { recursive: true });
  fs.writeFileSync(flagPath, defaultMode);
} catch (e) {
  // Silent fail -- flag is best-effort, don't block the hook
}

// --- 3. Emit caveman rules -----------------------------------------------
const EN_RULES =
  "CAVEMAN MODE ACTIVE. Rules: Drop articles/filler/pleasantries/hedging. " +
  "Fragments OK. Short synonyms. Pattern: [thing] [action] [reason]. [next step]. " +
  "Not: 'Sure! I'd be happy to help you with that.' " +
  "Yes: 'Bug in auth middleware. Fix:' " +
  "Code/commits/security: write normal. " +
  "User says 'normal' or 'stop caveman' to deactivate.";

// Try to read russian-rules.md from the skill directory for a richer prompt.
// Falls back to an inline summary if the file is unavailable.
function loadRuRules() {
  // Look for russian-rules.md relative to this hook file's parent (repo root),
  // then inside the caveman skill directory.
  const candidates = [
    path.join(__dirname, '..', 'skills', 'caveman', 'russian-rules.md'),
    path.join(process.cwd(), 'skills', 'caveman', 'russian-rules.md'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return "РЕЖИМ CAVEMAN-RU АКТИВЕН (по умолчанию: ru-full).\n\n" +
          fs.readFileSync(p, 'utf8');
      }
    } catch (e) {
      // Silent fail — try next candidate
    }
  }
  // Inline fallback — covers plugin installs where repo is not available
  return "РЕЖИМ CAVEMAN-RU АКТИВЕН (по умолчанию: ru-full). Отвечай по-русски, сжато, как умный пещерный человек. " +
    "Приоритеты: 1) понятность 2) краткость 3) техническая точность 4) красота. " +
    "Резать: вводные (конечно, в целом, скорее всего), вежливые обёртки (могу помочь, давайте разберём), " +
    "паразитные конструкции (проблема заключается в том, что). " +
    "Сжимать синтаксис: 'проблема в том, что X' → 'проблема: X'. " +
    "'приводит к тому, что Y' → '→ Y'. 'для того чтобы' → 'чтобы'. " +
    "Фрагменты допустимы. Подлежащее опускать, если ясно. " +
    "Шаблон: [что] [действие] [причина]. [следующий шаг]. " +
    "Инварианты — НЕ ТРОГАТЬ: код, команды оболочки, URL, пути, имена файлов, API, функции, классы, " +
    "переменные, библиотеки, JSON/YAML/XML/SQL, трассировки стека, цитаты ошибок. " +
    "Список разрешённых сокращений: т.к., т.е., и т.д., см., напр., кол-во, к-рый, св-во, БД, ОС, ПО, ЧТД. Новые не изобретать. " +
    "Не: 'Конечно! Я с радостью помогу. Проблема, скорее всего, связана с тем, что...' " +
    "Да: 'Ошибка в промежуточном обработчике авторизации. Проверка срока действия: `<` вместо `<=`. Исправление:' " +
    "Код/коммиты/запросы на слияние — нормальный текст. " +
    "Уровни: /caveman ru-lite | ru-full | ru-ultra | ru-notes. " +
    "Выключение: 'stop caveman', 'normal mode', 'обычный режим', 'нормальный режим'.";
}

let output = defaultLang === 'ru' ? loadRuRules() : EN_RULES;

// --- 4. Detect missing statusline config — nudge Claude to help set it up
try {
  let hasStatusline = false;
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.statusLine) {
      hasStatusline = true;
    }
  }

  if (!hasStatusline) {
    const isWindows = process.platform === 'win32';
    const scriptName = isWindows ? 'caveman-statusline.ps1' : 'caveman-statusline.sh';
    const scriptPath = path.join(__dirname, scriptName);
    const command = isWindows
      ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
      : `bash "${scriptPath}"`;
    const statusLineSnippet =
      '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
    output += "\n\n" +
      "STATUSLINE SETUP NEEDED: The caveman plugin includes a statusline badge showing active mode " +
      "(e.g. [CAVEMAN], [CAVEMAN:ULTRA], [CAVEMAN:RU-FULL]). It is not configured yet. " +
      "To enable, add this to ~/.claude/settings.json: " +
      statusLineSnippet + " " +
      "Proactively offer to set this up for the user on first interaction.";
  }
} catch (e) {
  // Silent fail — don't block session start over statusline detection
}

process.stdout.write(output);

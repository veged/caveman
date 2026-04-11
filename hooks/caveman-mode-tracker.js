#!/usr/bin/env node
// caveman — UserPromptSubmit hook to track which caveman mode is active
// Inspects user input for /caveman commands and writes mode to flag file.
//
// Also supports optional auto-detection of Russian prompts: when
// `caveman.autoDetectLanguage` is true in ~/.claude/settings.json (or
// CAVEMAN_AUTO_DETECT_LANG=1 in env), a prompt with >=30% Cyrillic characters
// will flip the current English mode to the corresponding Russian mode
// (full→ru-full, lite→ru-lite, ultra→ru-ultra), and a mostly-Latin prompt
// will flip back. Explicit /caveman commands always take precedence.

const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeDir = path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.caveman-active');
const settingsPath = path.join(claudeDir, 'settings.json');

const AUTO_DETECT_MIN_LEN = 15;
const CYRILLIC_RU_THRESHOLD = 0.30;
const CYRILLIC_EN_THRESHOLD = 0.05;

function readSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
    }
  } catch (e) {
    // Silent fail
  }
  return {};
}

function autoDetectEnabled(settings) {
  const env = (process.env.CAVEMAN_AUTO_DETECT_LANG || '').trim().toLowerCase();
  if (env === '1' || env === 'true' || env === 'yes') return true;
  if (env === '0' || env === 'false' || env === 'no') return false;
  const cfg = settings && settings.caveman;
  return !!(cfg && cfg.autoDetectLanguage);
}

function readFlag() {
  try {
    return fs.readFileSync(flagPath, 'utf8').trim();
  } catch (e) {
    return null;
  }
}

function writeFlag(mode) {
  try {
    fs.mkdirSync(path.dirname(flagPath), { recursive: true });
    fs.writeFileSync(flagPath, mode);
  } catch (e) {
    // Silent fail
  }
}

function deleteFlag() {
  try { fs.unlinkSync(flagPath); } catch (e) {}
}

// Computes the Cyrillic ratio on *letter* characters only, ignoring
// punctuation, whitespace, and digits. This prevents `console.log(123)` from
// being counted as "English".
function cyrillicLetterRatio(text) {
  let cyr = 0;
  let lat = 0;
  for (const ch of text) {
    if (/[а-яёА-ЯЁ]/.test(ch)) cyr++;
    else if (/[a-zA-Z]/.test(ch)) lat++;
  }
  const total = cyr + lat;
  if (total === 0) return 0;
  return cyr / total;
}

// Strip code fences / inline backticks so Cyrillic detection sees prose only.
function stripCode(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ');
}

// Map English mode → Russian equivalent, and vice versa.
const EN_TO_RU = {
  'full': 'ru-full',
  '': 'ru-full',
  'lite': 'ru-lite',
  'ultra': 'ru-ultra',
};
const RU_TO_EN = {
  'ru-full': 'full',
  'ru-lite': 'lite',
  'ru-ultra': 'ultra',
  // ru-notes has no English equivalent — keep as is when switching back.
  'ru-notes': 'full',
};

function isRussianMode(mode) {
  return typeof mode === 'string' && mode.startsWith('ru-');
}
function isGenericEnglishMode(mode) {
  return mode === 'full' || mode === 'lite' || mode === 'ultra' || mode === '' || mode == null;
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const rawPrompt = (data.prompt || '').trim();
    const prompt = rawPrompt.toLowerCase();

    // --- 1. Explicit /caveman commands always win ------------------------
    let explicitMode = null;
    if (prompt.startsWith('/caveman')) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0]; // /caveman, /caveman-commit, /caveman-review, etc.
      const arg = parts[1] || '';

      if (cmd === '/caveman-commit') {
        explicitMode = 'commit';
      } else if (cmd === '/caveman-review') {
        explicitMode = 'review';
      } else if (cmd === '/caveman-compress' || cmd === '/caveman:caveman-compress') {
        explicitMode = 'compress';
      } else if (cmd === '/caveman' || cmd === '/caveman:caveman') {
        if (arg === 'lite') explicitMode = 'lite';
        else if (arg === 'ultra') explicitMode = 'ultra';
        else if (arg === 'wenyan-lite') explicitMode = 'wenyan-lite';
        else if (arg === 'wenyan' || arg === 'wenyan-full') explicitMode = 'wenyan';
        else if (arg === 'wenyan-ultra') explicitMode = 'wenyan-ultra';
        else if (arg === 'ru' || arg === 'ru-full') explicitMode = 'ru-full';
        else if (arg === 'ru-lite') explicitMode = 'ru-lite';
        else if (arg === 'ru-ultra') explicitMode = 'ru-ultra';
        else if (arg === 'ru-notes') explicitMode = 'ru-notes';
        else explicitMode = 'full';
      } else if (cmd === '/caveman-ru' || cmd === '/caveman:caveman-ru') {
        if (arg === 'lite') explicitMode = 'ru-lite';
        else if (arg === 'ultra') explicitMode = 'ru-ultra';
        else if (arg === 'notes') explicitMode = 'ru-notes';
        else explicitMode = 'ru-full';
      }

      if (explicitMode) {
        writeFlag(explicitMode);
      }
    }

    // --- 2. Deactivation phrases (EN + RU) -------------------------------
    if (/\b(stop caveman|normal mode)\b/i.test(prompt) ||
        /(обычный режим|выключи пещерн|стоп пещерн|выключи caveman|нормальный режим)/i.test(prompt)) {
      deleteFlag();
      return;
    }

    // --- 3. Auto-detect language (opt-in) --------------------------------
    // Skip if user just issued an explicit /caveman command this turn.
    if (explicitMode) return;

    const settings = readSettings();
    if (!autoDetectEnabled(settings)) return;

    const prose = stripCode(rawPrompt);
    if (prose.length < AUTO_DETECT_MIN_LEN) return;

    const ratio = cyrillicLetterRatio(prose);
    const current = readFlag();
    if (current == null) return; // flag not set — respect deactivated state

    if (ratio >= CYRILLIC_RU_THRESHOLD && isGenericEnglishMode(current)) {
      const target = EN_TO_RU[current || 'full'] || 'ru-full';
      writeFlag(target);
    } else if (ratio <= CYRILLIC_EN_THRESHOLD && isRussianMode(current)) {
      const target = RU_TO_EN[current] || 'full';
      writeFlag(target);
    }
  } catch (e) {
    // Silent fail
  }
});

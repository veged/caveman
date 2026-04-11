#!/usr/bin/env node
// caveman — UserPromptSubmit hook to track which caveman mode is active
// Inspects user input for /caveman commands and writes mode to flag file

const fs = require('fs');
const path = require('path');
const os = require('os');

const flagPath = path.join(os.homedir(), '.claude', '.caveman-active');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').trim().toLowerCase();

    // Match /caveman commands
    if (prompt.startsWith('/caveman')) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0]; // /caveman, /caveman-commit, /caveman-review, etc.
      const arg = parts[1] || '';

      let mode = null;

      if (cmd === '/caveman-commit') {
        mode = 'commit';
      } else if (cmd === '/caveman-review') {
        mode = 'review';
      } else if (cmd === '/caveman-compress' || cmd === '/caveman:caveman-compress') {
        mode = 'compress';
      } else if (cmd === '/caveman' || cmd === '/caveman:caveman') {
        if (arg === 'lite') mode = 'lite';
        else if (arg === 'ultra') mode = 'ultra';
        else if (arg === 'wenyan-lite') mode = 'wenyan-lite';
        else if (arg === 'wenyan' || arg === 'wenyan-full') mode = 'wenyan';
        else if (arg === 'wenyan-ultra') mode = 'wenyan-ultra';
        else if (arg === 'ru' || arg === 'ru-full') mode = 'ru-full';
        else if (arg === 'ru-lite') mode = 'ru-lite';
        else if (arg === 'ru-ultra') mode = 'ru-ultra';
        else if (arg === 'ru-notes') mode = 'ru-notes';
        else mode = 'full';
      } else if (cmd === '/caveman-ru' || cmd === '/caveman:caveman-ru') {
        if (arg === 'lite') mode = 'ru-lite';
        else if (arg === 'ultra') mode = 'ru-ultra';
        else if (arg === 'notes') mode = 'ru-notes';
        else mode = 'ru-full';
      }

      if (mode) {
        fs.mkdirSync(path.dirname(flagPath), { recursive: true });
        fs.writeFileSync(flagPath, mode);
      }
    }

    // Detect deactivation (EN + RU)
    if (/\b(stop caveman|normal mode)\b/i.test(prompt) ||
        /(обычный режим|выключи пещерн|стоп пещерн|выключи caveman|нормальный режим)/i.test(prompt)) {
      try { fs.unlinkSync(flagPath); } catch (e) {}
    }
  } catch (e) {
    // Silent fail
  }
});

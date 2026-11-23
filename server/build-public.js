const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '../client');
const output = path.join(__dirname, 'public-online');
const publicFiles = [
  'style.css', 'code.js', 'game-audio.js', 'room-connection.js',
  'bang/table.css', 'bang/card-catalog.js', 'bang/characters.js', 'bang/character-picker.js',
  'bang/card-art.js', 'bang/online-table.js', 'bang/game-notices.js', 'bang/board-effects.js',
  'bang/table-seats.js', 'bang/practice.js', 'bang/table.js',
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, 'bang'), { recursive: true });
for (const file of publicFiles) fs.copyFileSync(path.join(source, file), path.join(output, file));
fs.cpSync(path.join(source, 'bang/assets'), path.join(output, 'bang/assets'), { recursive: true });

const lobby = fs.readFileSync(path.join(source, 'index.html'), 'utf8')
  .replace(/^ *<a class="practice-link"[^\n]*\r?\n/m, '');
const table = fs.readFileSync(path.join(source, 'bang/index.html'), 'utf8')
  .replace(/^ *<script defer src="(?:turn-flow|game-snapshot|bot-turn|practice-rules|game-actions)\.js"><\/script>\r?\n/gm, '');
fs.writeFileSync(path.join(output, 'index.html'), lobby);
fs.writeFileSync(path.join(output, 'bang/index.html'), table);

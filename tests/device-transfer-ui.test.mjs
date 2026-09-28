import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('new-player splash shows device receive shortcut immediately below how-to', async () => {
  const game = await readFile('public/g/game-20260928.js', 'utf8');
  assert.match(game, /id="howBtn">Cách chơi<\/button>\s*\$\{o\.day<=1\?'<button class="ghost" id="recvBtn" type="button">Đã có tiệm ở máy khác\?<\/button>':""\}/);
  assert.match(game, /id="recvBtn"/);
  assert.match(game, /__aunomayTransferReceive/);
});

test('account transfer area uses mobile-friendly action card instead of inline result pane', async () => {
  const game = await readFile('public/g/game-20260928.js', 'utf8');
  const html = await readFile('public/index.html', 'utf8');
  assert.match(game, /caTransferCard/);
  assert.match(game, /caTransferAction/);
  assert.doesNotMatch(game, /id="tmTransferPane"/);
  assert.match(html, /\.caTransferCard/);
  assert.match(html, /\.tmCodeDisplay/);
});

test('transfer receive flow uses the game modal and 8-character code field', async () => {
  const game = await readFile('public/g/game-20260928.js', 'utf8');
  assert.match(game, /id="tmCodeInput"/);
  assert.match(game, /class="tmScode"/);
  assert.match(game, /id="tmReceiveNow"/);
  assert.match(game, /document\.getElementById\('modal'\)/);
});

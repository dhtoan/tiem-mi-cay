import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('game exposes guest cross-device transfer UI', async () => {
  const game = await readFile('public/g/game-20260928.js', 'utf8');
  assert.match(game, /Chuyển sang máy khác/);
  assert.match(game, /Nhận tiệm từ máy khác/);
  assert.match(game, /Mã chuyển tiệm/);
  assert.match(game, /api\/sync/);
});

test('worker exposes temporary sync-code API', async () => {
  const worker = await readFile('src/worker.js', 'utf8');
  assert.match(worker, /\/api\/sync/);
  assert.match(worker, /SYNC_CODE_TTL_MS/);
  assert.match(worker, /sync_codes/);
});

test('D1 schema includes temporary transfer codes', async () => {
  const migration = await readFile('migrations/0004_transfer_codes.sql', 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sync_codes/i);
  assert.match(migration, /expires_at/i);
});


test('transfer-code generator uses the actual alphabet length', async () => {
  const worker = await readFile('src/worker.js', 'utf8');
  assert.match(worker, /bytes\[i\]\s*%\s*SYNC_CODE_ALPHABET\.length/);
  assert.doesNotMatch(worker, /bytes\[i\]\s*&\s*31/);
});

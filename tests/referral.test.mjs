import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';
test('referral rescue has backend, QR share and money bridge',async()=>{
 for(const p of ['../public/referral.js','../public/referral.css','../public/vendor/qrcode.min.js','../migrations/0003_referrals.sql']) await access(new URL(p,import.meta.url));
 const worker=await readFile(new URL('../src/worker.js',import.meta.url),'utf8');
 for(const p of ['/api/referral/me','/api/referral/claim','/api/referral/rewards/take']) assert.ok(worker.includes(p),'missing '+p);
 const game=await readFile(new URL('../public/g/game-20260928.js',import.meta.url),'utf8');
 assert.ok(game.includes('window.getMoney'),'money getter bridge missing');
 assert.ok(game.includes('window.setMoney'),'money setter bridge missing');
 const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.ok(index.includes('/referral.css'));assert.ok(index.includes('/vendor/qrcode.min.js'));assert.ok(index.includes('/referral.js'));
 const client=await readFile(new URL('../public/referral.js',import.meta.url),'utf8');
 for(const m of ['navigator.share','QRCode','ref=','aunomay_pending_ref']) assert.ok(client.includes(m),'client missing '+m);
});

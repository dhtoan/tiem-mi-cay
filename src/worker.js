const MAX_NAME = 26;
const CHAL_TRIES = 3;
const CHAL_DURATION_MS = 30 * 60 * 1000;
const PRANK_KINDS = new Set(['rat', 'drunk', 'sidewalk', 'mac', 'tour', 'celeb']);
const ID_RE = /^[a-z0-9]{8,24}$/;
const CLIENT_KEYS = ['mc!7Ay#q', 't0m~yum*'];
const APP_VERSION = '2026.09.28-report2';
const AUTH_COOKIE = 'micay_session';
const USER_RE = /^[\p{L}\p{N}][\p{L}\p{N}._-]{2,31}$/u;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const PBKDF2_ITER = 120000;
const SAVE_MAX_BYTES = 180 * 1024;
const DEFAULT_ALLOWED_HOSTS = new Set(['tiem-mi-cay.aunomay.workers.dev']);
const REPORT_SOURCE_URL = 'https://aenhatrang.com/report-tinh-nang';
const REPORT_CACHE_MS = 10 * 60 * 1000;
const REPORT_LOCAL_FEATURES = [
  { name: 'Rửa tô cuối ngày', aliases: ['rửa tô'] },
  { name: 'Nước lẩu bí truyền', aliases: ['nước lẩu bí truyền'] },
  { name: 'Chạy xe giao đơn xa', aliases: ['giao đơn xa', 'giao xa'] },
  { name: 'iPhone mất cột đầu trong bếp', aliases: ['iphone mất cột đầu', 'transform scale'] },
  { name: 'Trang tải nhanh hơn', aliases: ['trang tải nhanh', 'file mã phiên bản'] },
  { name: 'Nồi luộc thứ ba, vợt múc mì, chờ Cô Chôm', aliases: ['nồi luộc thứ ba', 'vợt múc mì', 'chờ cô chôm'] },
  { name: 'Nút cộng trừ ở tab Kho và Giá bán', aliases: ['nút cộng trừ', 'giữ nút'] },
  { name: 'Thanh chỉnh âm lượng nhạc và âm thanh', aliases: ['thanh chỉnh âm lượng', 'âm lượng nhạc'] },
  { name: 'Vòng thời gian quanh khách', aliases: ['vòng thời gian quanh khách'] },
  { name: 'Loa hỏng không làm hỏng game', aliases: ['loa hỏng'] },
  { name: 'Bản web đã làm rối mã', aliases: ['bản web đã làm rối mã', 'ios 12'] },
];
const REPORT_AUNOMAY_ONLY = [
  { name: 'Tài khoản Aunomay', description: 'Đăng ký, đăng nhập và phiên tài khoản trên Cloudflare D1.' },
  { name: 'Cloud autosave liên tục', description: 'Tự lưu sau thay đổi, lưu định kỳ và đồng bộ nhiều thiết bị có chống xung đột.' },
  { name: 'Nhắc tạo tài khoản', description: 'Hiệu ứng nhắc người chơi guest bật tự động lưu cloud mà không làm gián đoạn gameplay.' },
  { name: 'Security Mode', description: 'Host lock, chống iframe/hotlink, minify production và không source map.' },
  { name: 'Cloudflare production stack', description: 'Workers + Static Assets + D1 + CI + migrations + custom domain.' },
];
let reportCache = { at: 0, data: null };
let authSchemaReady = false;
let authSchemaInit = null;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (!isAllowedHost(url, env)) return blockedHost(url);
      if (url.pathname.startsWith('/api/')) {
        const response = await routeApi(request, env, url);
        return withApiHeaders(response);
      }
      if (url.pathname === '/report-tinh-nang/latest-frame') {
        return reportMirrorResponse(request);
      }
      if (url.pathname === '/report-tinh-nang' || url.pathname === '/report-tinh-nang/') {
        const assetUrl = new URL('/report-tinh-nang/index.html', url);
        const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), {
          method: 'GET',
          headers: request.headers,
        }));
        return withSiteHeaders(response, url);
      }
      const response = await env.ASSETS.fetch(request);
      return withSiteHeaders(response, url);
    } catch (error) {
      console.error('Unhandled worker error', error);
      if (url.pathname.startsWith('/api/')) {
        return withApiHeaders(json({ error: 'Máy chủ đang bận, thử lại sau nha.' }, 500));
      }
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

async function reportMirrorResponse(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  let response;
  try {
    response = await fetch(REPORT_SOURCE_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Aunomay-Tiem-Mi-Cay-Report-Mirror/1.0',
      },
    });
  } catch (error) {
    console.error('Report mirror fetch failed', error);
    return new Response('<!doctype html><meta charset="utf-8"><p>Không tải được nội dung mới nhất.</p>', {
      status: 502,
      headers: reportMirrorHeaders(),
    });
  }
  if (!response.ok) {
    return new Response('<!doctype html><meta charset="utf-8"><p>Nội dung mới nhất tạm thời không khả dụng.</p>', {
      status: 502,
      headers: reportMirrorHeaders(),
    });
  }
  const sourceHtml = await response.text();
  const html = sanitizeReportMirror(sourceHtml);
  return new Response(html, { status: 200, headers: reportMirrorHeaders() });
}

function sanitizeReportMirror(html) {
  const sourceBase = new URL(REPORT_SOURCE_URL).origin + '/';
  let out = String(html || '');

  out = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?\s*>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<(object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+formaction\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Keep the exact source CSS and image paths working while disabling all
  // user navigation away from the Aunomay report tab.
  out = out
    .replace(/<a\b[^>]*>/gi, '<span class="aunomay-mirror-link">')
    .replace(/<\/a>/gi, '</span>')
    .replace(/<form\b[^>]*>/gi, '<div class="aunomay-mirror-form">')
    .replace(/<\/form>/gi, '</div>');

  const headInsert = `<base href="${sourceBase}"><meta name="robots" content="noindex,nofollow"><style>
.aunomay-mirror-link{color:inherit;text-decoration:inherit;cursor:default}
.aunomay-mirror-form button,.aunomay-mirror-form input[type=submit]{pointer-events:none}
</style>`;
  if (/<head\b[^>]*>/i.test(out)) {
    out = out.replace(/<head\b([^>]*)>/i, '<head$1>' + headInsert);
  } else {
    out = '<!doctype html><html><head>' + headInsert + '</head><body>' + out + '</body></html>';
  }
  return out;
}

function reportMirrorHeaders() {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https://aenhatrang.com; img-src data: blob: https://aenhatrang.com; font-src data: https://aenhatrang.com; media-src https://aenhatrang.com; connect-src 'none'; frame-src 'none'; frame-ancestors 'self'; form-action 'none'; base-uri https://aenhatrang.com",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

async function routeApi(request, env, url) {
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/api/err') return clientErrorReport(request);
  if (path === '/api/report-features') return reportFeatures(request, env);
  if (!env.DB) return json({ error: 'Database chưa được cấu hình.' }, 503);
  if (path === '/api/health') return healthCheck(env);
  if (path === '/api/lb') return leaderboard(request, env, url);
  if (path === '/api/chal') return challenge(request, env, url);
  if (path === '/api/prank') return prank(request, env, url);
  if (path === '/api/auth/register') return authRegister(request, env, url);
  if (path === '/api/auth/login') return authLogin(request, env, url);
  if (path === '/api/auth/logout') return authLogout(request, env, url);
  if (path === '/api/auth/me') return authMe(request, env);
  if (path === '/api/save') return cloudSave(request, env, url);
  if (path === '/api/ai') return aiReply(request, env);
  return json({ error: 'Không tìm thấy API.' }, 404);
}

async function reportFeatures(request, env) {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const now = Date.now();
  if (reportCache.data && now - reportCache.at < REPORT_CACHE_MS) {
    return json({ ...reportCache.data, cached: true, cacheAgeMs: now - reportCache.at });
  }

  let response;
  try {
    response = await fetch(REPORT_SOURCE_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Aunomay-Tiem-Mi-Cay-Feature-Monitor/1.0',
      },
    });
  } catch (error) {
    console.error('Feature report source fetch failed', error);
    if (reportCache.data) return json({ ...reportCache.data, cached: true, stale: true, sourceError: 'Không tải được nguồn mới nhất.' });
    return json({ ok: false, error: 'Không tải được trang nguồn để so sánh tính năng.' }, 502);
  }
  if (!response.ok) {
    if (reportCache.data) return json({ ...reportCache.data, cached: true, stale: true, sourceError: 'Nguồn trả lỗi ' + response.status });
    return json({ ok: false, error: 'Trang nguồn trả lỗi ' + response.status + '.' }, 502);
  }

  const html = await response.text();
  const parsed = parseFeatureReport(html);
  const latest = parseLatestReportContent(html);
  const comparison = parsed.features.map(feature => {
    const local = matchLocalFeature(feature.name);
    return {
      ...feature,
      status: local ? 'implemented' : 'missing',
      localName: local?.name || null,
      isNew: !local,
    };
  });
  const newFeatures = comparison.filter(x => x.status === 'missing');
  const digestInput = JSON.stringify(parsed.features.map(x => [x.name, x.tests, x.description]));
  const fingerprint = await reportSha256Hex(digestInput);
  const data = {
    ok: true,
    checkedAt: now,
    version: APP_VERSION,
    source: {
      date: parsed.date,
      testSummary: parsed.testSummary,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    },
    latest,
    counts: {
      sourceFeatures: comparison.length,
      implemented: comparison.length - newFeatures.length,
      missing: newFeatures.length,
      aunomayOnly: REPORT_AUNOMAY_ONLY.length,
    },
    comparison,
    newFeatures,
    aunomayOnly: REPORT_AUNOMAY_ONLY,
    fingerprint,
    cached: false,
  };
  reportCache = { at: now, data };
  return json(data);
}

function parseLatestReportContent(html) {
  const title = htmlText((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || 'Báo cáo tính năng');
  const firstSectionIndex = html.search(/<section\b[^>]*class=["'][^"']*card[^"']*["']/i);
  const beforeSections = firstSectionIndex >= 0 ? html.slice(0, firstSectionIndex) : html;
  const introMatch = beforeSections.match(/<h1[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  const intro = htmlText(introMatch?.[1] || '');

  const stats = [];
  const statRe = /<div[^>]*class=["'][^"']*stat[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let stat;
  while ((stat = statRe.exec(beforeSections))) {
    const block = stat[1];
    const value = htmlText((block.match(/<b[^>]*>([\s\S]*?)<\/b>/i) || [])[1] || '');
    const label = htmlText(block.replace(/<b[^>]*>[\s\S]*?<\/b>/i, ' '));
    if (value || label) stats.push({ value, label });
  }

  const sections = [];
  const sectionRe = /<section\b[^>]*class=["'][^"']*card[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi;
  let section;
  while ((section = sectionRe.exec(html))) {
    const block = section[1];
    const heading = htmlText((block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1] || '');
    if (!heading) continue;
    const tag = htmlText((block.match(/<span[^>]*class=["'][^"']*tag[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) || [])[1] || '');
    const pill = htmlText((block.match(/<span[^>]*class=["'][^"']*pill[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) || [])[1] || '');

    const blocks = [];
    const tokenRe = /<(h3|p|summary|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let token;
    while ((token = tokenRe.exec(block))) {
      const text = htmlText(token[2]);
      if (!text) continue;
      blocks.push({ type: token[1].toLowerCase(), text });
    }

    const tables = [];
    const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let table;
    while ((table = tableRe.exec(block))) {
      const rows = [];
      const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
      let row;
      while ((row = rowRe.exec(table[1]))) {
        const cells = [];
        const cellRe = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
        let cell;
        while ((cell = cellRe.exec(row[1]))) {
          cells.push({ header: cell[1].toLowerCase() === 'th', text: htmlText(cell[2]) });
        }
        if (cells.length) rows.push(cells);
      }
      if (rows.length) tables.push({ rows });
    }

    sections.push({ title: heading, tag, pill, blocks, tables });
  }

  return {
    title,
    intro,
    date: (html.match(/Tiệm Mì Cay\s*·\s*([^<\n]+)/i) || [])[1] ? htmlText((html.match(/Tiệm Mì Cay\s*·\s*([^<\n]+)/i) || [])[1]) : null,
    stats,
    sections,
  };
}

function parseFeatureReport(html) {
  const dateMatch = html.match(/Tiệm Mì Cay\s*·\s*([^<\n]+)/i);
  const statMatch = html.match(/<div[^>]*class=["'][^"']*stat\s+big[^"']*["'][^>]*>\s*<b>([^<]+)<\/b>/i);
  const features = [];
  const sectionRe = /<section\b[^>]*class=["'][^"']*card[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi;
  let section;
  while ((section = sectionRe.exec(html))) {
    const block = section[1];
    const title = htmlText((block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1] || '');
    if (!title) continue;
    const tag = htmlText((block.match(/<span[^>]*class=["'][^"']*tag[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) || [])[1] || '');
    const pill = htmlText((block.match(/<span[^>]*class=["'][^"']*pill[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) || [])[1] || '');
    const firstP = htmlText((block.match(/<div[^>]*class=["'][^"']*txt[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '');

    if (normalizeFeatureName(title) === normalizeFeatureName('Các tính năng khác')) {
      const tbody = (block.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i) || [])[1] || '';
      const rowRe = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
      let row;
      while ((row = rowRe.exec(tbody))) {
        features.push({
          name: htmlText(row[1]),
          category: 'Cùng đợt',
          tests: htmlText(row[3]),
          description: htmlText(row[2]),
        });
      }
      continue;
    }

    const normalized = normalizeFeatureName(title);
    if (['bo test game', 'chi phi', 'lich su loi da sua'].includes(normalized)) continue;
    if (tag || ['iphone mat cot dau trong bep', 'trang tai nhanh hon'].includes(normalized)) {
      features.push({ name: title, category: tag || 'Cập nhật', tests: pill, description: firstP });
    }
  }
  return {
    date: dateMatch ? htmlText(dateMatch[1]) : null,
    testSummary: statMatch ? htmlText(statMatch[1]) : null,
    features,
  };
}

function htmlText(value) {
  return decodeHtml(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeHtml(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, code) => {
    if (code[0] === '#') {
      const hex = code[1]?.toLowerCase() === 'x';
      const n = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    }
    return named[code.toLowerCase()] ?? _;
  });
}

function normalizeFeatureName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchLocalFeature(name) {
  const n = normalizeFeatureName(name);
  for (const feature of REPORT_LOCAL_FEATURES) {
    const candidates = [feature.name, ...(feature.aliases || [])].map(normalizeFeatureName);
    if (candidates.some(x => x === n || (x.length >= 8 && (n.includes(x) || x.includes(n))))) return feature;
  }
  return null;
}

async function reportSha256Hex(value) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
}

async function clientErrorReport(request) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  const b = await bodyJson(request);
  if (b) {
    console.warn('Client game error', {
      message: cleanText(b.m, 200),
      stack: cleanText(b.s, 400),
      userAgent: cleanText(b.ua, 180),
    });
  }
  return new Response(null, { status: 204 });
}

async function leaderboard(request, env) {
  let playerId = null;
  if (request.method === 'POST') {
    const b = await bodyJson(request);
    if (!b) return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
    const id = cleanId(b.id);
    playerId = id;
    const name = cleanName(b.name);
    const profit = int(b.profit);
    const day = int(b.day);
    const served = int(b.served);
    const lv = int(b.lv);
    const rate = Number(b.rate);
    const t = int(b.t);
    if (!id || !name || !Number.isFinite(profit) || day < 1 || served < 0 || lv < 1 || lv > 99 || !Number.isFinite(rate) || rate < 0 || rate > 5 || t < 1) {
      return json({ error: 'Thành tích không hợp lệ.' }, 400);
    }
    if (!verifyClientSig([id, name, profit, day, served, lv, rate, t].join('|'), b.sig)) {
      return json({ error: 'Chữ ký thành tích không hợp lệ.' }, 400);
    }
    if (profit > day * 5_000_000 || served > day * 110 || profit > Math.max(served, 1) * 150_000 || profit < -day * 5_000_000) {
      return json({ error: 'Thành tích vượt giới hạn hợp lệ.' }, 400);
    }
    const now = Date.now();
    await touchPlayer(env.DB, id, name, lv, now);
    const write = await env.DB.prepare(`
      INSERT INTO leaderboard(player_id,name,profit,day,served,level,rating,client_time,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(player_id) DO UPDATE SET
        name=excluded.name, profit=excluded.profit, day=excluded.day, served=excluded.served,
        level=excluded.level, rating=excluded.rating, client_time=excluded.client_time, updated_at=excluded.updated_at
      WHERE excluded.day >= leaderboard.day AND excluded.served >= leaderboard.served
    `).bind(id, name, profit, day, served, lv, rate, t, now).run();
    if (!write.meta?.changes) return json({ error: 'Bản lưu này cũ hơn thành tích đã có trên máy chủ.' }, 400);
  } else if (request.method !== 'GET') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  return leaderboardPayload(env.DB, playerId);
}

async function leaderboardPayload(db, id) {
  const topRes = await db.prepare(`
    SELECT player_id AS id, name, profit, day, served, level AS lv, rating AS rate
    FROM leaderboard
    ORDER BY profit DESC, served DESC, updated_at ASC
    LIMIT 50
  `).all();
  const totalRow = await db.prepare('SELECT COUNT(*) AS n FROM leaderboard').first();
  let rank = 0;
  if (id) {
    const me = await db.prepare('SELECT profit FROM leaderboard WHERE player_id=?').bind(id).first();
    if (me) {
      const r = await db.prepare('SELECT COUNT(*) + 1 AS r FROM leaderboard WHERE profit > ?').bind(me.profit).first();
      rank = Number(r?.r || 0);
    }
  }
  const cups = await previousWeekCups(db, vnDate());
  return json({ top: topRes.results || [], total: Number(totalRow?.n || 0), rank, cups });
}

async function challenge(request, env, url) {
  if (request.method === 'GET') {
    const id = cleanId(url.searchParams.get('id'));
    if (!id) return json({ error: 'Mã quán không hợp lệ.' }, 400);
    await touchPlayer(env.DB, id, null, null, Date.now());
    return json(await challengeBoard(env.DB, id, vnDate()));
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const b = await bodyJson(request);
  if (!b) return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  if (b.op === 'start') return challengeStart(env.DB, b);
  if (b.op === 'end') return challengeEnd(env.DB, b);
  return json({ error: 'Thao tác không hợp lệ.' }, 400);
}

async function challengeStart(db, b) {
  const id = cleanId(b.id);
  if (!id) return json({ error: 'Mã quán không hợp lệ.' }, 400);
  const day = vnDate();
  const now = Date.now();
  await touchPlayer(db, id, null, null, now);
  const token = randomToken();
  const res = await db.prepare(`
    INSERT INTO challenge_runs(token,player_id,day,attempt,started_at,expires_at)
    SELECT ?,?,?,COALESCE((SELECT MAX(attempt)+1 FROM challenge_runs WHERE player_id=? AND day=?),1),?,?
    WHERE (SELECT COUNT(*) FROM challenge_runs WHERE player_id=? AND day=?) < ?
    RETURNING attempt
  `).bind(token, id, day, id, day, now, now + CHAL_DURATION_MS, id, day, CHAL_TRIES).first();
  if (!res?.attempt) return json({ error: `Hôm nay đã dùng hết ${CHAL_TRIES} lượt thi.` }, 429);
  return json({ day, n: Number(res.attempt), token });
}

async function challengeEnd(db, b) {
  const id = cleanId(b.id);
  const name = cleanName(b.name);
  const day = cleanDay(b.day);
  const n = int(b.n);
  const token = typeof b.token === 'string' ? b.token.slice(0, 96) : '';
  const score = int(b.score);
  const served = int(b.served);
  const perfect = int(b.perfect);
  const wrong = int(b.wrong);
  const lost = int(b.lost);
  if (!id || !name || !day || !token || n < 1 || n > CHAL_TRIES || ![score, served, perfect, wrong, lost].every(Number.isFinite)) {
    return json({ error: 'Kết quả thi không hợp lệ.' }, 400);
  }
  const signed = [id, day, n, score, served, perfect, wrong, lost, token].join('|');
  if (!verifyClientSig(signed, b.sig)) return json({ error: 'Chữ ký kết quả không hợp lệ.' }, 400);
  if (served < 0 || served > 20 || perfect < 0 || perfect > served || lost < 0 || served + lost > 20 || wrong < 0 || wrong > 200 || score < 0) {
    return json({ error: 'Kết quả thi vượt giới hạn.' }, 400);
  }
  const maxScore = Math.max(0, served * 170 - wrong * 30 - lost * 50);
  if (score > maxScore) return json({ error: 'Điểm số không khớp kết quả thi.' }, 400);
  const run = await db.prepare('SELECT * FROM challenge_runs WHERE token=?').bind(token).first();
  if (!run || run.player_id !== id || run.day !== day || Number(run.attempt) !== n) return json({ error: 'Lượt thi không tồn tại.' }, 400);
  if (run.finished_at) return json({ error: 'Lượt thi này đã gửi điểm rồi.' }, 409);
  const now = Date.now();
  if (Number(run.expires_at) < now) return json({ error: 'Lượt thi đã hết hạn, thi lại lượt mới nha.' }, 410);
  await touchPlayer(db, id, name, null, now);
  await db.prepare(`
    UPDATE challenge_runs SET name=?, finished_at=?, score=?, served=?, perfect=?, wrong=?, lost=?
    WHERE token=? AND finished_at IS NULL
  `).bind(name, now, score, served, perfect, wrong, lost, token).run();
  const board = await challengeBoard(db, id, day);
  return json({ rank: board.me.rank || 0, total: board.total || 0, best: board.me.best || 0 });
}

async function challengeBoard(db, id, day) {
  const { start, end } = weekRange(day);
  const top = (await db.prepare(`
    SELECT id,name,s,b FROM (
      SELECT cr.player_id AS id, p.name AS name, cr.score AS s, cr.served AS b,
             ROW_NUMBER() OVER(PARTITION BY cr.player_id ORDER BY cr.score DESC, cr.finished_at ASC) AS rn
      FROM challenge_runs cr JOIN players p ON p.id=cr.player_id
      WHERE cr.day=? AND cr.finished_at IS NOT NULL
    ) WHERE rn=1 ORDER BY s DESC, b DESC LIMIT 50
  `).bind(day).all()).results || [];
  const totalRow = await db.prepare(`SELECT COUNT(DISTINCT player_id) AS n FROM challenge_runs WHERE day=? AND finished_at IS NOT NULL`).bind(day).first();
  const wtop = (await db.prepare(`
    WITH daily AS (
      SELECT player_id, day, MAX(score) AS best
      FROM challenge_runs
      WHERE day BETWEEN ? AND ? AND finished_at IS NOT NULL
      GROUP BY player_id, day
    ), sums AS (
      SELECT player_id, SUM(best) AS s FROM daily GROUP BY player_id
    )
    SELECT sums.player_id AS id, p.name AS name, sums.s AS s
    FROM sums JOIN players p ON p.id=sums.player_id
    ORDER BY sums.s DESC LIMIT 50
  `).bind(start, end).all()).results || [];
  const wtotalRow = await db.prepare(`
    SELECT COUNT(DISTINCT player_id) AS n FROM challenge_runs
    WHERE day BETWEEN ? AND ? AND finished_at IS NOT NULL
  `).bind(start, end).first();
  const attemptsRow = await db.prepare('SELECT COUNT(*) AS n FROM challenge_runs WHERE player_id=? AND day=?').bind(id, day).first();
  const bestRow = await db.prepare('SELECT MAX(score) AS best FROM challenge_runs WHERE player_id=? AND day=? AND finished_at IS NOT NULL').bind(id, day).first();
  const best = Number(bestRow?.best || 0);
  let rank = 0;
  if (best > 0) {
    const rr = await db.prepare(`
      WITH bests AS (SELECT player_id, MAX(score) AS s FROM challenge_runs WHERE day=? AND finished_at IS NOT NULL GROUP BY player_id)
      SELECT COUNT(*) + 1 AS r FROM bests WHERE s > ?
    `).bind(day, best).first();
    rank = Number(rr?.r || 0);
  }
  const wbestRow = await db.prepare(`
    WITH daily AS (
      SELECT day, MAX(score) AS best FROM challenge_runs
      WHERE player_id=? AND day BETWEEN ? AND ? AND finished_at IS NOT NULL GROUP BY day
    ) SELECT SUM(best) AS s FROM daily
  `).bind(id, start, end).first();
  const wbest = Number(wbestRow?.s || 0);
  let wrank = 0;
  if (wbest > 0) {
    const rr = await db.prepare(`
      WITH daily AS (
        SELECT player_id, day, MAX(score) AS best FROM challenge_runs
        WHERE day BETWEEN ? AND ? AND finished_at IS NOT NULL GROUP BY player_id,day
      ), sums AS (SELECT player_id,SUM(best) AS s FROM daily GROUP BY player_id)
      SELECT COUNT(*) + 1 AS r FROM sums WHERE s > ?
    `).bind(start, end, wbest).first();
    wrank = Number(rr?.r || 0);
  }
  const cups = await previousWeekCups(db, day);
  return {
    day,
    top,
    wtop,
    total: Number(totalRow?.n || 0),
    wtotal: Number(wtotalRow?.n || 0),
    me: {
      best,
      rank,
      left: Math.max(0, CHAL_TRIES - Number(attemptsRow?.n || 0)),
      wbest,
      wrank,
    },
    cups,
  };
}

async function previousWeekCups(db, day) {
  const { start } = weekRange(day);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(start, -7);
  const rows = (await db.prepare(`
    WITH daily AS (
      SELECT player_id, day, MAX(score) AS best FROM challenge_runs
      WHERE day BETWEEN ? AND ? AND finished_at IS NOT NULL GROUP BY player_id,day
    ), sums AS (SELECT player_id,SUM(best) AS s FROM daily GROUP BY player_id)
    SELECT player_id AS id FROM sums ORDER BY s DESC LIMIT 3
  `).bind(prevStart, prevEnd).all()).results || [];
  const out = {};
  rows.forEach((r, i) => { out[r.id] = i + 1; });
  return out;
}

async function prank(request, env, url) {
  if (request.method === 'GET') {
    const id = cleanId(url.searchParams.get('id'));
    if (!id) return json({ error: 'Mã quán không hợp lệ.' }, 400);
    await touchPlayer(env.DB, id, null, null, Date.now());
    return json(await prankInfo(env.DB, id));
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const b = await bodyJson(request);
  if (!b) return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  if (b.op === 'send') return prankSend(env.DB, b);
  if (b.op === 'take') return prankTake(env.DB, b);
  return json({ error: 'Thao tác không hợp lệ.' }, 400);
}

async function prankInfo(db, id) {
  const day = vnDate();
  const sentRows = (await db.prepare('SELECT to_id FROM pranks WHERE from_id=? AND day=?').bind(id, day).all()).results || [];
  const left = Math.max(0, 3 - sentRows.length);
  const me = await db.prepare('SELECT profit FROM leaderboard WHERE player_id=?').bind(id).first();
  let near;
  if (me) {
    near = (await db.prepare(`
      SELECT l.player_id AS id,l.name,l.level AS lv,
        (SELECT COUNT(*)+1 FROM leaderboard x WHERE x.profit>l.profit) AS rank
      FROM leaderboard l WHERE l.player_id<>?
      ORDER BY ABS(l.profit-?) ASC, l.profit DESC LIMIT 8
    `).bind(id, me.profit).all()).results || [];
  } else {
    near = (await db.prepare(`
      SELECT l.player_id AS id,l.name,l.level AS lv,
        (SELECT COUNT(*)+1 FROM leaderboard x WHERE x.profit>l.profit) AS rank
      FROM leaderboard l WHERE l.player_id<>?
      ORDER BY l.profit DESC LIMIT 8
    `).bind(id).all()).results || [];
  }
  return { left, sent: sentRows.map(x => x.to_id), near };
}

async function prankSend(db, b) {
  const from = cleanId(b.from);
  const to = cleanId(b.to);
  const kind = typeof b.k === 'string' ? b.k : '';
  if (!from || !to || from === to || !PRANK_KINDS.has(kind)) return json({ error: 'Quà hoặc mã quán không hợp lệ.' }, 400);
  const now = Date.now();
  const day = vnDate();
  await touchPlayer(db, from, null, null, now);
  const target = await db.prepare('SELECT name,receive_pranks FROM players WHERE id=?').bind(to).first();
  if (target && Number(target.receive_pranks) === 0) return json({ error: 'Quán này đang tắt nhận quà.' }, 409);
  const sender = await db.prepare('SELECT name FROM players WHERE id=?').bind(from).first();
  try {
    const write = await db.prepare(`
      INSERT INTO pranks(from_id,to_id,kind,sender_name,day,created_at)
      SELECT ?,?,?,?,?,?
      WHERE (SELECT COUNT(*) FROM pranks WHERE from_id=? AND day=?) < 3
    `).bind(from, to, kind, cleanName(sender?.name || 'Tiệm Mì Cay'), day, now, from, day).run();
    if (!write.meta?.changes) return json({ error: 'Hôm nay đã dùng hết 3 lượt gửi.' }, 429);
  } catch (e) {
    if (String(e).toLowerCase().includes('unique')) return json({ error: 'Hôm nay bạn đã gửi quà cho quán này rồi.' }, 409);
    throw e;
  }
  return json({ name: cleanName(target?.name || 'Tiệm Mì Cay') });
}

async function prankTake(db, b) {
  const id = cleanId(b.id);
  if (!id) return json({ error: 'Mã quán không hợp lệ.' }, 400);
  const off = Number(b.off) === 1;
  const now = Date.now();
  await touchPlayer(db, id, null, null, now);
  await db.prepare('UPDATE players SET receive_pranks=?, last_seen=? WHERE id=?').bind(off ? 0 : 1, now, id).run();
  if (off) return json({ gifts: [] });
  const rows = (await db.prepare(`
    SELECT id,from_id AS f,sender_name AS n,kind AS k
    FROM pranks WHERE to_id=? AND claimed_at IS NULL
    ORDER BY created_at ASC LIMIT 6
  `).bind(id).all()).results || [];
  if (rows.length) {
    const ids = rows.map(x => Number(x.id)).filter(Number.isFinite);
    const marks = ids.map(() => '?').join(',');
    await db.prepare(`UPDATE pranks SET claimed_at=? WHERE claimed_at IS NULL AND id IN (${marks})`).bind(now, ...ids).run();
  }
  return json({ gifts: rows.map(({ f, n, k }) => ({ f, n: cleanName(n), k })) });
}

async function aiReply(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const b = await bodyJson(request);
  if (!b) return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  const id = cleanId(b.id);
  const name = cleanName(b.n || 'Khách');
  const q = cleanText(b.q, 120);
  const review = cleanText(b.rv, 240);
  let stars = clamp(int(b.s), 1, 5, 3);
  const polite = /(cảm ơn|xin lỗi|xin loi|mong|mời|moi|rất tiếc|rat tiec|ghi nhận|ghi nhan)/i.test(q);
  const harsh = /(im đi|vớ vẩn|vo van|không thích thì|khong thich thi|biến|bien di|xàm|xam|kệ|ke ban)/i.test(q);
  if (polite) stars = Math.min(5, stars + 1);
  if (harsh) stars = Math.max(1, stars - 1);
  const low = stars <= 2;
  const mid = stars === 3;
  const mentionsSpicy = /(cay|spicy|ớt|ot)/i.test(review + ' ' + q);
  const options = low
    ? [
        `Mình ghi nhận lời quán rồi. ${polite ? 'Cách trả lời này làm mình thấy được tôn trọng hơn.' : 'Mình vẫn mong lần sau quán xử lý tốt hơn nha.'}`,
        `${polite ? 'Cảm ơn quán đã phản hồi tử tế.' : 'Mình đọc rồi nha.'} Hy vọng lần tới trải nghiệm sẽ ổn hơn.`,
      ]
    : mid
      ? [
          `Cảm ơn quán đã trả lời. Mình sẽ cho quán thêm một cơ hội lần tới.`,
          `${mentionsSpicy ? 'Lần sau nhớ canh đúng cấp cay giúp mình nha.' : 'Mong lần sau quán giữ phong độ ổn định hơn nha.'}`,
        ]
      : [
          `Dễ thương quá, cảm ơn quán đã trả lời mình nha! Mình sẽ ghé lại.`,
          `Phản hồi có tâm nè. Lần sau mình lại gọi một tô nữa 🌶️`,
        ];
  const seed = fnv(`${id || ''}|${name}|${q}|${review}|${Date.now() >> 16}`);
  const idx = parseInt(seed, 36) % options.length;
  return json({ reply: options[idx].slice(0, 120), stars });
}

async function touchPlayer(db, id, name, level, now) {
  const nm = name ? cleanName(name) : null;
  const lv = Number.isFinite(Number(level)) ? clamp(int(level), 1, 99, 1) : null;
  await db.prepare(`
    INSERT INTO players(id,name,level,last_seen) VALUES(?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=CASE WHEN ? IS NULL THEN players.name ELSE ? END,
      level=CASE WHEN ? IS NULL THEN players.level ELSE ? END,
      last_seen=excluded.last_seen
  `).bind(id, nm || 'Tiệm Mì Cay', lv || 1, now, nm, nm, lv, lv).run();
}


async function healthCheck(env) {
  try {
    await ensureAuthSchema(env.DB);
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('accounts','sessions','cloud_saves')").first();
    return json({ ok: true, service: 'tiem-mi-cay', version: APP_VERSION, day: vnDate(), db: true, authSchema: Number(row?.n || 0) === 3, authHash: 'sha256-salted-v2' });
  } catch (error) {
    console.error('Health/D1 error', error);
    return json({ ok: false, service: 'tiem-mi-cay', version: APP_VERSION, day: vnDate(), db: false, authSchema: false }, 503);
  }
}

async function ensureAuthSchema(db) {
  if (authSchemaReady) return;
  if (!authSchemaInit) {
    authSchemaInit = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_iterations INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS cloud_saves (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        save_data TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        client_updated_at INTEGER,
        updated_at INTEGER NOT NULL
      )`)
    ]).then(() => {
      authSchemaReady = true;
    }).catch(error => {
      authSchemaInit = null;
      throw error;
    });
  }
  await authSchemaInit;
}

async function authRegister(request, env, url) {
  await ensureAuthSchema(env.DB);
  if (request.method !== 'POST') return methodNotAllowed('POST');
  if (!sameOrigin(request, url)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  const b = await bodyJson(request);
  if (!b) return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  const username = normalizeUsername(b.username);
  const password = typeof b.password === 'string' ? b.password : '';
  const displayName = cleanText(b.displayName || username, MAX_NAME).replace(/[<>]/g, '') || username;
  if (!username) return json({ error: 'Tên đăng nhập cần 3–32 ký tự và chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.' }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: 'Mật khẩu cần từ 8 đến 128 ký tự.' }, 400);

  let exists;
  try {
    exists = await env.DB.prepare('SELECT 1 FROM accounts WHERE username=? COLLATE NOCASE').bind(username).first();
  } catch (error) {
    console.error('Auth register lookup failed', error);
    return json({ error: 'Database tài khoản chưa sẵn sàng. Vui lòng thử lại sau vài giây.', code: 'AUTH_DB_NOT_READY' }, 503);
  }
  if (exists) return json({ error: 'Tên đăng nhập đã được sử dụng.' }, 409);

  const salt = randomHex(16);
  const passwordIterations = 0;
  const passwordHash = await hashPasswordFast(password, salt);
  const now = Date.now();
  const accountId = randomHex(16);
  try {
    await env.DB.prepare(`
      INSERT INTO accounts(id,username,display_name,password_hash,password_salt,password_iterations,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?)
    `).bind(accountId, username, displayName, passwordHash, salt, passwordIterations, now, now).run();
  } catch (e) {
    console.error('Auth register insert failed', e);
    if (String(e).toLowerCase().includes('unique')) return json({ error: 'Tên đăng nhập đã được sử dụng.' }, 409);
    return json({ error: 'Không thể tạo tài khoản lúc này. Vui lòng thử lại.', code: 'AUTH_REGISTER_FAILED' }, 503);
  }
  return issueSession(env.DB, request, { id: accountId, username, display_name: displayName }, 201);
}

async function authLogin(request, env, url) {
  await ensureAuthSchema(env.DB);
  if (request.method !== 'POST') return methodNotAllowed('POST');
  if (!sameOrigin(request, url)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  const b = await bodyJson(request);
  if (!b) return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  const username = normalizeUsername(b.username);
  const password = typeof b.password === 'string' ? b.password : '';
  if (!username || !password) return json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' }, 401);

  const row = await env.DB.prepare(`
    SELECT id,username,display_name,password_hash,password_salt,password_iterations
    FROM accounts WHERE username=? COLLATE NOCASE
  `).bind(username).first();
  if (!row) return json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' }, 401);
  const storedIterations = Number(row.password_iterations);
  let got;
  if (Number.isFinite(storedIterations) && storedIterations > 0) {
    got = await hashPassword(password, row.password_salt, storedIterations);
  } else {
    got = await hashPasswordFast(password, row.password_salt);
  }
  if (!timingSafeEqual(got, row.password_hash)) return json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' }, 401);
  return issueSession(env.DB, request, row, 200);
}

async function authLogout(request, env, url) {
  await ensureAuthSchema(env.DB);
  if (request.method !== 'POST') return methodNotAllowed('POST');
  if (!sameOrigin(request, url)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  const raw = cookieValue(request.headers.get('Cookie'), AUTH_COOKIE);
  if (raw) {
    const tokenHash = await sha256Hex(raw);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();
  }
  const res = json({ ok: true });
  res.headers.append('Set-Cookie', sessionCookie('', request, 0));
  return res;
}

async function authMe(request, env) {
  await ensureAuthSchema(env.DB);
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const user = await sessionUser(env.DB, request);
  if (!user) return json({ ok: true, authenticated: false, user: null });
  return json({ ok: true, authenticated: true, user: publicUser(user) });
}

async function cloudSave(request, env, url) {
  await ensureAuthSchema(env.DB);
  const user = await sessionUser(env.DB, request);
  if (!user && request.method === 'GET') {
    return json({ ok: true, authenticated: false, save: null, revision: 0, updatedAt: null });
  }
  if (!user) return json({ error: 'Chưa đăng nhập.' }, 401);

  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT save_data,revision,client_updated_at,updated_at FROM cloud_saves WHERE account_id=?')
      .bind(user.id).first();
    if (!row) return json({ ok: true, save: null, revision: 0, updatedAt: null });
    return json({
      ok: true,
      save: row.save_data,
      revision: Number(row.revision || 0),
      clientUpdatedAt: row.client_updated_at == null ? null : Number(row.client_updated_at),
      updatedAt: Number(row.updated_at || 0),
    });
  }

  if (request.method !== 'PUT' && request.method !== 'POST') return methodNotAllowed('GET, PUT, POST');
  if (!sameOrigin(request, url)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  const b = await bodyJson(request);
  if (!b || typeof b.save !== 'string') return json({ error: 'Bản lưu không hợp lệ.' }, 400);
  const bytes = new TextEncoder().encode(b.save).byteLength;
  if (bytes < 2 || bytes > SAVE_MAX_BYTES) return json({ error: 'Bản lưu vượt giới hạn cho phép.' }, 413);

  const current = await env.DB.prepare('SELECT revision FROM cloud_saves WHERE account_id=?').bind(user.id).first();
  const currentRevision = Number(current?.revision || 0);
  if (b.revision != null) {
    const expected = Number(b.revision);
    if (!Number.isInteger(expected) || expected !== currentRevision) {
      return json({ error: 'Bản lưu trên cloud đã thay đổi ở thiết bị khác.', revision: currentRevision }, 409);
    }
  }

  const revision = currentRevision + 1;
  const now = Date.now();
  const clientUpdatedAt = Number.isFinite(Number(b.clientUpdatedAt)) ? Math.max(0, Math.trunc(Number(b.clientUpdatedAt))) : null;
  await env.DB.prepare(`
    INSERT INTO cloud_saves(account_id,save_data,revision,client_updated_at,updated_at)
    VALUES(?,?,?,?,?)
    ON CONFLICT(account_id) DO UPDATE SET
      save_data=excluded.save_data,
      revision=excluded.revision,
      client_updated_at=excluded.client_updated_at,
      updated_at=excluded.updated_at
  `).bind(user.id, b.save, revision, clientUpdatedAt, now).run();
  return json({ ok: true, revision, updatedAt: now });
}

async function issueSession(db, request, account, status) {
  const raw = randomHex(32);
  const tokenHash = await sha256Hex(raw);
  const now = Date.now();
  const expires = now + SESSION_MS;
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  await db.prepare('INSERT INTO sessions(token_hash,account_id,created_at,expires_at,last_seen) VALUES(?,?,?,?,?)')
    .bind(tokenHash, account.id, now, expires, now).run();
  const res = json({ ok: true, user: publicUser(account) }, status);
  res.headers.append('Set-Cookie', sessionCookie(raw, request, Math.floor(SESSION_MS / 1000)));
  return res;
}

async function sessionUser(db, request) {
  const raw = cookieValue(request.headers.get('Cookie'), AUTH_COOKIE);
  if (!raw || raw.length < 32) return null;
  const tokenHash = await sha256Hex(raw);
  const now = Date.now();
  const row = await db.prepare(`
    SELECT a.id,a.username,a.display_name,s.expires_at,s.last_seen
    FROM sessions s JOIN accounts a ON a.id=s.account_id
    WHERE s.token_hash=?
  `).bind(tokenHash).first();
  if (!row || Number(row.expires_at || 0) <= now) {
    if (row) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();
    return null;
  }
  if (now - Number(row.last_seen || 0) > 15 * 60 * 1000) {
    await db.prepare('UPDATE sessions SET last_seen=? WHERE token_hash=?').bind(now, tokenHash).run();
  }
  return row;
}

function publicUser(row) {
  return { id: row.id, username: row.username, displayName: row.display_name };
}

function normalizeUsername(v) {
  const s = String(v || '').normalize('NFKC').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, '_');
  return USER_RE.test(s) ? s : '';
}

function sameOrigin(request, url) {
  const origin = request.headers.get('Origin');
  return !origin || origin === url.origin;
}

function methodNotAllowed(allow) {
  const res = json({ error: 'Phương thức không được hỗ trợ.' }, 405);
  res.headers.set('Allow', allow);
  return res;
}

function sessionCookie(value, request, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${AUTH_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`;
}

function cookieValue(header, name) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
}

function hexBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function hashPasswordFast(password, saltHex) {
  const data = new TextEncoder().encode('micay-auth-v2\0' + saltHex + '\0' + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexBytes(saltHex), iterations },
    key,
    256
  );
  return Array.from(new Uint8Array(bits), x => x.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function configuredHosts(env) {
  const extra = String(env?.ALLOWED_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_HOSTS, ...extra]);
}

function isAllowedHost(url, env) {
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  return configuredHosts(env).has(host);
}

function blockedHost(url) {
  const body = url.pathname.startsWith('/api/')
    ? JSON.stringify({ error: 'Bản triển khai này không được cấp phép cho hostname hiện tại.' })
    : '<!doctype html><meta charset="utf-8"><title>Tiệm Mì Cay</title><style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#fff3f0;color:#4a2a2a}main{max-width:560px;padding:28px;text-align:center}</style><main><h1>Tiệm Mì Cay</h1><p>Bản triển khai này không được cấp phép cho hostname hiện tại.</p></main>';
  return new Response(body, {
    status: 403,
    headers: {
      'Content-Type': url.pathname.startsWith('/api/') ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    }
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function withApiHeaders(response) {
  const h = new Headers(response.headers);
  h.set('Cache-Control', 'no-store');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  h.set('X-Frame-Options', 'DENY');
  h.set('X-Robots-Tag', 'noarchive, nosnippet');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

function withSiteHeaders(response, url) {
  const h = new Headers(response.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  h.set('X-Frame-Options', 'DENY');
  h.set('X-Robots-Tag', 'noarchive, nosnippet');
  h.set('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; frame-ancestors 'none'");
  const contentType = h.get('Content-Type') || '';
  if (contentType.includes('text/html')) {
    h.set('Cache-Control', 'no-store, max-age=0');
  } else if (url && url.pathname.startsWith('/g/')) {
    h.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (url && url.pathname.startsWith('/assets/media/')) {
    h.set('Cache-Control', 'public, max-age=2592000');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

async function bodyJson(request) {
  try {
    const max = 256 * 1024;
    const len = Number(request.headers.get('content-length') || 0);
    if (len > max) return null;
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > max) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}


function cleanId(v) {
  v = typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return ID_RE.test(v) ? v : '';
}
function cleanName(v) {
  v = cleanText(v, MAX_NAME).replace(/[<>]/g, '');
  return v || 'Tiệm Mì Cay';
}
function cleanText(v, max) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanDay(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : ''; }
function int(v) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : NaN; }
function clamp(v, min, max, fallback) { return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback; }

function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
function clientSig(t) {
  return fnv(CLIENT_KEYS[0] + t).padStart(7, '0') + fnv(t + CLIENT_KEYS[1]).padStart(7, '0');
}
function verifyClientSig(text, sig) { return typeof sig === 'string' && sig === clientSig(text); }
function randomToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
}
function vnDate(now = Date.now()) { return new Date(now + 7 * 3600e3).toISOString().slice(0, 10); }
function parseDay(s) { return new Date(`${s}T00:00:00Z`); }
function fmtDay(d) { return d.toISOString().slice(0, 10); }
function addDays(s, n) { const d = parseDay(s); d.setUTCDate(d.getUTCDate() + n); return fmtDay(d); }
function weekRange(day) {
  const d = parseDay(day);
  const offset = (d.getUTCDay() + 6) % 7;
  const start = addDays(day, -offset);
  return { start, end: addDays(start, 6) };
}
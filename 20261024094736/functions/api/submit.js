/**
 * POST /api/submit
 * 接收投稿 → 校验 → 存 D1（approved = 0 待审核）
 *
 * 需要的绑定（Cloudflare Pages 控制台里配置）：
 *   D1 数据库   变量名 DB
 *   KV 命名空间 变量名 RATELIMIT
 *   环境变量（加密） TURNSTILE_SECRET
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

const LIMIT_MAX = 3;        // 10 分钟内最多提交次数
const LIMIT_WINDOW = 600;   // 限流窗口（秒），10 分钟

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// 字数：按“字符”算，避免 emoji 被算成 2 个字
const len = s => Array.from(s).length;

// 只接受字符串，防止有人传数组 / 对象进来
const asText = v => (typeof v === 'string' ? v.trim() : '');

async function verifyTurnstile(token, secret, ip) {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: ip || ''
    })
  });
  const out = await res.json().catch(() => ({}));
  return out.success === true;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // ---------- 1. 解析请求 ----------
  let data = {};
  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      data = await request.json();
    } else {
      const form = await request.formData();
      data = Object.fromEntries(form.entries());
    }
  } catch {
    return json({ success: false, error: '请求格式有误' }, 400);
  }

  const nickname = asText(data.nickname);
  const title    = asText(data.title);
  const content  = asText(data.content);
  const type     = asText(data.type) || 'article';
  const token    = asText(data['cf-turnstile-response']) || asText(data.turnstile);
  const website  = asText(data.website);   // 蜜罐字段，正常用户看不到

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // ---------- 2. 蜜罐：填了就直接丢弃（对外仍返回成功，让机器人以为得手了）----------
  if (website !== '') {
    return json({ success: true, spam: true });
  }

  // ---------- 3. 字段校验 ----------
  if (len(title) < 2 || len(title) > 100) {
    return json({ success: false, error: '标题需要 2 - 100 个字' }, 400);
  }
  if (len(content) < 10 || len(content) > 5000) {
    return json({ success: false, error: '内容需要 10 - 5000 个字' }, 400);
  }
  if (len(nickname) > 50) {
    return json({ success: false, error: '昵称最多 50 个字' }, 400);
  }
  if (type !== 'article' && type !== 'podcast') {
    return json({ success: false, error: '投稿类型不合法' }, 400);
  }

  // ---------- 4. 同 IP 限流（KV）----------
  const key = `rl:${ip}`;
  const current = parseInt((await env.RATELIMIT.get(key)) || '0', 10) || 0;
  if (current >= LIMIT_MAX) {
    return json({ success: false, error: '提交太频繁了，请 10 分钟后再试' }, 429);
  }
  await env.RATELIMIT.put(key, String(current + 1), { expirationTtl: LIMIT_WINDOW });

  // ---------- 5. Turnstile 人机验证 ----------
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    return json({ success: false, error: '服务端未配置 TURNSTILE_SECRET' }, 500);
  }
  if (!token || !(await verifyTurnstile(token, secret, ip))) {
    await env.RATELIMIT.put(key, String(current), { expirationTtl: LIMIT_WINDOW }); // 失败不扣次数
    return json({ success: false, error: '人机验证未通过，请刷新页面重试' }, 403);
  }

  // ---------- 6. 入库（approved = 0，等站长审核）----------
  try {
    await env.DB.prepare(
      `INSERT INTO posts (nickname, title, content, type, approved, ip, created_at)
       VALUES (?, ?, ?, ?, 0, ?, datetime('now'))`
    )
      .bind(nickname || '匿名', title, content, type, ip)
      .run();
  } catch (err) {
    return json({ success: false, error: '服务器写入失败：' + err.message }, 500);
  }

  return json({ success: true });
}

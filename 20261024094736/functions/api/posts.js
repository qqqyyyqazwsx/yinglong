/**
 * GET /api/posts
 * 只查 approved = 1 的投稿，按最新在前返回。
 * 待审核（approved = 0）的内容不会被查出来，前台也就不可能渲染。
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, nickname, title, content, type, created_at
         FROM posts
        WHERE approved = 1
        ORDER BY id DESC
        LIMIT 200`
    ).all();

    return new Response(
      JSON.stringify({ success: true, posts: results || [] }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: '读取失败：' + err.message, posts: [] }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
}

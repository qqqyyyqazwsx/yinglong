-- 应龙计算 · 用户投稿表
-- 用法见下面的“审核说明”，第一次建表只需要执行本文件里的全部内容

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname   TEXT    NOT NULL DEFAULT '匿名',
  title      TEXT    NOT NULL,
  content    TEXT    NOT NULL,
  type       TEXT    NOT NULL DEFAULT 'article',   -- article = 文章，podcast = 播客选题
  approved   INTEGER NOT NULL DEFAULT 0,           -- 0 = 待审核，1 = 已通过（前台只查 1）
  ip         TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))   -- UTC 时间
);

-- 前台列表查询走这个索引
CREATE INDEX IF NOT EXISTS idx_posts_approved ON posts (approved, id DESC);

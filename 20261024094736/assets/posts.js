/* 投稿列表：只拉取 approved = 1 的内容，全部用 textContent 渲染（防 XSS） */
(() => {
  const wrap = document.getElementById('posts');
  if (!wrap) return;

  // D1 里存的是 UTC 时间字符串 "YYYY-MM-DD HH:MM:SS"
  function formatTime(s) {
    if (!s) return '';
    const d = new Date(s.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return s;
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;   // 不用 innerHTML，杜绝脚本注入
    return node;
  }

  function render(posts) {
    wrap.textContent = '';

    if (!posts.length) {
      const empty = el('p', 'empty');
      empty.appendChild(document.createTextNode('还没有通过审核的投稿。'));
      const a = el('a', null, '去投稿');
      a.href = 'submit.html';
      a.style.color = '#219912';
      empty.appendChild(document.createTextNode(' '));
      empty.appendChild(a);
      wrap.appendChild(empty);
      return;
    }

    posts.forEach(p => {
      const card = el('article', 'post');

      const head = el('div', 'post-head');
      head.appendChild(el('span', 'tag', p.type === 'podcast' ? '播客选题' : '文章'));
      head.appendChild(el('h2', 'post-title', p.title));
      card.appendChild(head);

      card.appendChild(
        el('div', 'post-meta', `${p.nickname || '匿名'} · ${formatTime(p.created_at)}`)
      );
      card.appendChild(el('div', 'post-body', p.content));

      wrap.appendChild(card);
    });
  }

  fetch('api/posts')
    .then(r => r.json())
    .then(data => {
      if (data && data.success) {
        render(data.posts || []);
      } else {
        render([]);
      }
    })
    .catch(() => {
      wrap.textContent = '';
      wrap.appendChild(el('p', 'empty', '加载失败，请刷新页面重试。'));
    });
})();

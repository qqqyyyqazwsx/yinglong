/* 投稿表单：字数统计 + fetch 提交到 /api/submit */
(() => {
  const form  = document.getElementById('postForm');
  const btn   = document.getElementById('submitBtn');
  const msg   = document.getElementById('msg');
  if (!form) return;

  const f = name => form.elements[name];          // 用 elements 取值，避免 form.title 之类的属性冲突

  const titleInput   = f('title');
  const contentInput = f('content');
  const titleCount   = document.getElementById('titleCount');
  const contentCount = document.getElementById('contentCount');

  // 字数：按字符算，和后端保持一致
  const len = s => Array.from(s).length;

  function updateCounters() {
    const t = len(titleInput.value);
    const c = len(contentInput.value);
    titleCount.textContent = `${t} / 100`;
    contentCount.textContent = `${c} / 5000`;
    titleCount.classList.toggle('over', t > 100);
    contentCount.classList.toggle('over', c > 5000);
  }
  titleInput.addEventListener('input', updateCounters);
  contentInput.addEventListener('input', updateCounters);
  updateCounters();

  function showMsg(text, type) {
    msg.textContent = text;
    msg.className = 'msg show ' + type;
  }

  function resetTurnstile() {
    if (window.turnstile && typeof window.turnstile.reset === 'function') {
      window.turnstile.reset();
    }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.className = 'msg';

    const nickname = f('nickname').value.trim();
    const title    = titleInput.value.trim();
    const content  = contentInput.value.trim();
    const type     = f('type').value;
    const website  = f('website').value;   // 蜜罐：正常情况永远为空

    // 前端先粗筛一遍，省得白跑一趟网络
    if (len(title) < 2 || len(title) > 100) { showMsg('标题需要 2 - 100 个字', 'err'); return; }
    if (len(content) < 10 || len(content) > 5000) { showMsg('内容需要 10 - 5000 个字', 'err'); return; }
    if (len(nickname) > 50) { showMsg('昵称最多 50 个字', 'err'); return; }

    // Turnstile 验证完成后会自动生成这个隐藏字段
    const tokenField = form.querySelector('[name="cf-turnstile-response"]');
    const token = tokenField ? tokenField.value : '';
    if (!token) { showMsg('请先完成人机验证', 'err'); return; }

    btn.disabled = true;
    btn.textContent = '提交中…';

    try {
      const res = await fetch('api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          nickname,
          title,
          content,
          type,
          website,
          'cf-turnstile-response': token
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        showMsg('投稿成功，审核通过后将会展示', 'ok');
        form.reset();
        updateCounters();
      } else {
        showMsg(data.error || '提交失败，请稍后再试', 'err');
      }
      resetTurnstile();
    } catch {
      showMsg('网络异常，请稍后再试', 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = '提交投稿';
    }
  });
})();

// 「日記」：日付ごとの一覧／カレンダー、タグ・キーワードでの絞り込み
import { store } from '../store.js';
import { esc, dateKey, fmtDate, fmtTime, topbar, $, $$, hydratePhotos, nav, pad } from '../ui.js';
import { icon } from '../icons.js';

export function entryCard(e) {
  const pal = (e.colors || []);
  return `
  <article class="entry-card" data-go="#/entry/${e.id}" role="link" tabindex="0">
    <div class="ec-photo">
      <img data-photo="${e.id}" alt="${esc(e.title || '夜景の写真')}">
      ${e.sample ? '<span class="badge">サンプル</span>' : ''}
    </div>
    <div class="ec-pal">${pal.length ? pal.map(c => `<i style="background:${c.hex}"></i>`).join('') : '<i class="none"></i>'}</div>
    <div class="ec-body">
      <h3>${esc(e.title || '無題の夜')}</h3>
      <p class="ec-meta"><span>${fmtTime(e.createdAt)}</span>${(e.tags || []).slice(0, 4).map(t => `<span class="t">#${esc(t)}</span>`).join('')}</p>
    </div>
  </article>`;
}

function groupByDay(list) {
  const m = new Map();
  list.forEach(e => { const k = dateKey(e.createdAt); if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
  return [...m.entries()];
}

export async function renderDiary(root, _p, query) {
  const state = {
    view: query.view === 'cal' ? 'cal' : 'list',
    tag: query.tag || '',
    q: query.q || '',
    month: query.m || dateKey(new Date()).slice(0, 7),
    day: query.d || '',
  };

  const syncHash = () => {
    const p = new URLSearchParams();
    if (state.view === 'cal') p.set('view', 'cal');
    if (state.tag) p.set('tag', state.tag);
    if (state.view === 'cal') { p.set('m', state.month); if (state.day) p.set('d', state.day); }
    const raw = '/diary' + (p.toString() ? '?' + p.toString() : '');
    history.replaceState(null, '', '#' + raw);
    nav.stack[nav.stack.length - 1] = raw;
  };

  root.innerHTML = `
    ${topbar({ title: '日記', right: `<button class="icon-btn" id="searchToggle" aria-label="さがす">${icon('search')}</button>` })}
    <div class="pad-x">
      <div class="seg" role="tablist">
        <button role="tab" data-view="list">${icon('list', 18)} 一覧</button>
        <button role="tab" data-view="cal">${icon('calendar', 18)} カレンダー</button>
      </div>
      <div class="searchbar ${state.q ? 'open' : ''}" id="searchbar">
        ${icon('search', 18)}<input type="search" id="q" placeholder="タイトル・一言・タグからさがす" value="${esc(state.q)}" enterkeyhint="search">
      </div>
      <div class="chips scroll" id="tagChips"></div>
    </div>
    <div id="diaryBody"></div>`;

  const body = $('#diaryBody', root);

  const filtered = () => store.entries.filter(e => {
    if (state.tag && !(e.tags || []).includes(state.tag)) return false;
    if (state.q) {
      const hay = [e.title, e.memo, ...(e.tags || []), ...(e.colors || []).map(c => c.name + ' ' + (c.nickname || ''))].join(' ').toLowerCase();
      if (!hay.includes(state.q.toLowerCase())) return false;
    }
    return true;
  });

  const drawChips = () => {
    const counts = store.tagCounts();
    $('#tagChips', root).innerHTML = counts.length ? `
      <button class="chip ${!state.tag ? 'on' : ''}" data-tag="">すべて</button>
      ${counts.map(([t, n]) => `<button class="chip ${state.tag === t ? 'on' : ''}" data-tag="${esc(t)}">#${esc(t)} <small>${n}</small></button>`).join('')}` : '';
  };

  const drawList = () => {
    const list = filtered();
    if (!store.entries.length) {
      body.innerHTML = `<div class="empty">${icon('moon', 36)}<p>まだ記録はありません。</p><p class="small-note">綺麗だと思った夜に、写真と色を残してみてください。</p><button class="btn primary" data-go="#/new">${icon('camera', 18)} 夜景を記録する</button></div>`;
      return;
    }
    if (!list.length) { body.innerHTML = `<div class="empty"><p>当てはまる記録はありません。</p></div>`; return; }
    const head = state.tag ? `<p class="filter-head">#${esc(state.tag)} の夜 ・ ${list.length}件</p>` : '';
    body.innerHTML = head + groupByDay(list).map(([k, es]) => `
      <section class="day-group">
        <h3 class="day-head">${fmtDate(k + 'T12:00:00')}${es.length > 1 ? `<small>${es.length}件</small>` : ''}</h3>
        ${es.map(entryCard).join('')}
      </section>`).join('');
  };

  const drawCal = () => {
    const [y, m] = state.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysIn = new Date(y, m, 0).getDate();
    const byDay = new Map(groupByDay(filtered()));
    const todayK = dateKey(new Date());
    let cells = '';
    for (let i = 0; i < first.getDay(); i++) cells += '<div class="cal-cell blank"></div>';
    for (let d = 1; d <= daysIn; d++) {
      const k = `${y}-${pad(m)}-${pad(d)}`;
      const es = byDay.get(k) || [];
      const cols = es.flatMap(e => e.colors || []).slice(0, 6);
      cells += `<button class="cal-cell ${es.length ? 'has' : ''} ${k === todayK ? 'today' : ''} ${state.day === k ? 'sel' : ''}" data-day="${k}" ${es.length ? '' : 'disabled'} aria-label="${m}月${d}日${es.length ? ` 記録${es.length}件` : ''}">
        <span class="cd">${d}</span>
        <span class="cdots">${es.length ? (cols.length ? cols.map(c => `<i style="background:${c.hex}"></i>`).join('') : '<i class="plain"></i>') : ''}</span>
      </button>`;
    }
    const monthCount = [...byDay.keys()].filter(k => k.startsWith(state.month)).reduce((n, k) => n + byDay.get(k).length, 0);
    const sel = state.day && byDay.get(state.day);
    body.innerHTML = `
      <div class="cal pad-x">
        <div class="cal-head">
          <button class="icon-btn" id="prevM" aria-label="前の月">${icon('back')}</button>
          <div class="cal-title"><strong>${y}年 ${m}月</strong><small>${monthCount ? `${monthCount}件の夜` : '記録なし'}</small></div>
          <button class="icon-btn" id="nextM" aria-label="次の月">${icon('right')}</button>
        </div>
        <div class="cal-grid wd">${['日', '月', '火', '水', '木', '金', '土'].map(w => `<span>${w}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        <p class="small-note center">色の点は、その日に採集した色です。</p>
      </div>
      <div id="dayList">${sel ? `<section class="day-group"><h3 class="day-head">${fmtDate(state.day + 'T12:00:00')}${sel.length > 1 ? `<small>${sel.length}件</small>` : ''}</h3>${sel.map(entryCard).join('')}</section>` : (monthCount ? '<p class="small-note center">日付を選ぶと、その日の記録が表示されます。</p>' : '')}</div>`;
    $('#prevM', body).onclick = () => shiftMonth(-1);
    $('#nextM', body).onclick = () => shiftMonth(1);
    $$('[data-day]', body).forEach(b => b.onclick = () => { state.day = state.day === b.dataset.day ? '' : b.dataset.day; draw(); });
  };
  const shiftMonth = (n) => {
    const [y, m] = state.month.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    state.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    state.day = '';
    draw();
  };

  const draw = () => {
    $$('[data-view]', root).forEach(b => { b.classList.toggle('on', b.dataset.view === state.view); b.setAttribute('aria-selected', b.dataset.view === state.view); });
    drawChips();
    state.view === 'cal' ? drawCal() : drawList();
    hydratePhotos(body);
    syncHash();
  };

  $$('[data-view]', root).forEach(b => b.onclick = () => { state.view = b.dataset.view; draw(); });
  $('#tagChips', root).addEventListener('click', e => {
    const c = e.target.closest('[data-tag]'); if (!c) return;
    state.tag = c.dataset.tag; draw();
  });
  $('#searchToggle', root).onclick = () => { const sb = $('#searchbar', root); sb.classList.toggle('open'); if (sb.classList.contains('open')) $('#q', root).focus(); };
  $('#q', root).addEventListener('input', e => { state.q = e.target.value.trim(); draw(); });

  draw();
}

// 起動とルーティング（#/... のハッシュで画面を切り替える）
import { store } from './store.js';
import { $, go, back, nav, hydratePhotos } from './ui.js';
import { icon } from './icons.js';
import { renderTonight, renderLetters, renderLetter } from './views/tonight.js';
import { renderDiary } from './views/diary.js';
import { renderEntry } from './views/entry.js';
import { renderCollection, renderColor } from './views/collection.js';
import { renderSettings } from './views/settings.js';
import { openCapture } from './views/capture.js';

const routes = [
  [/^\/?$/, renderTonight, 'tonight'],
  [/^\/letters$/, renderLetters, 'tonight'],
  [/^\/letter\/([\w-]+)$/, renderLetter, 'tonight'],
  [/^\/diary$/, renderDiary, 'diary'],
  [/^\/entry\/([\w-]+)$/, renderEntry, 'diary'],
  [/^\/colors$/, renderCollection, 'colors'],
  [/^\/color\/([\w-]+)\/([\w-]+)$/, renderColor, 'colors'],
  [/^\/settings$/, renderSettings, 'settings'],
];

const scrollMemo = new Map();

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  return { path: decodeURIComponent(path), query, raw };
}

function renderTabbar(active) {
  const tab = (key, href, ic, label) =>
    `<a href="${href}" class="tab ${active === key ? 'on' : ''}" ${active === key ? 'aria-current="page"' : ''}>${icon(ic, 22)}<span>${label}</span></a>`;
  $('#tabbar').innerHTML = `
    ${tab('tonight', '#/', 'moon', '今夜')}
    ${tab('diary', '#/diary', 'book', '日記')}
    <button class="tab-capture" id="captureBtn" aria-label="夜景を残す">
      <span class="cap-ring">${icon('drop', 24)}</span><span>残す</span>
    </button>
    ${tab('colors', '#/colors', 'palette', '色')}
    ${tab('settings', '#/settings', 'more', 'その他')}`;
  $('#captureBtn').onclick = () => go('#/new');
}

let rendering = 0;
async function router() {
  const { path, query, raw } = parseHash();

  // 記録の作成・編集はフルスクリーンの画面（履歴スタックには積まない）
  const mNew = path.match(/^\/new$/), mEdit = path.match(/^\/edit\/([\w-]+)$/);

  // 戻る／進むの判定（戻るボタンの挙動用）
  const s = nav.stack;
  const prev = s[s.length - 1];
  const isBack = s.length > 1 && s[s.length - 2] === raw;
  if (!(mNew || mEdit)) {
    if (isBack) s.pop(); else if (prev !== raw) s.push(raw);
    if (prev && !document.body.classList.contains('capturing')) scrollMemo.set(prev, window.scrollY);
  }

  if (mNew || mEdit) {
    document.body.classList.add('capturing');
    openCapture({ editId: mEdit ? mEdit[1] : null, letterId: query.letter || null });
    return;
  }
  document.body.classList.remove('capturing');
  document.querySelector('.capture')?.remove();

  const my = ++rendering;
  for (const [re, fn, tab] of routes) {
    const m = path.match(re);
    if (!m) continue;
    renderTabbar(tab);
    const view = $('#view');
    const fresh = document.createElement('main');
    fresh.id = 'view';
    fresh.className = 'view';
    await fn(fresh, m.slice(1), query);
    if (my !== rendering) return; // 途中で別の画面に移った
    view.replaceWith(fresh);
    hydratePhotos(fresh);
    bindCommon(fresh);
    window.scrollTo(0, isBack ? (scrollMemo.get(raw) || 0) : 0);
    fresh.classList.add('enter');
    return;
  }
  go('#/');
}

function bindCommon(root) {
  root.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); go(g.dataset.go); return; }
    const b = e.target.closest('[data-back]');
    if (b) { e.preventDefault(); back(b.dataset.back || '#/'); }
  });
}

async function boot() {
  try {
    await store.init();
  } catch (err) {
    console.error(err);
    $('#view').innerHTML = `<div class="boot-error"><h2>データを読み込めませんでした</h2><p>プライベートブラウズでは保存が使えない場合があります。通常のタブで開き直してください。</p><pre>${String(err && err.message || err)}</pre></div>`;
    return;
  }
  document.body.classList.add('ready');
  window.addEventListener('hashchange', router);
  router();
  document.getElementById('splash')?.classList.add('hide');
  setTimeout(() => document.getElementById('splash')?.remove(), 900);
}

// Service Worker（HTTPS か localhost のときだけ）
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// ホーム画面から起動したかどうか
if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) document.documentElement.classList.add('standalone');

export function rerender() { router(); }
window.__nightscape = { store, rerender };

boot();

// 画面共通の小さな道具
import { store } from './store.js';
import { icon } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}
// アプリ内で辿った履歴（戻るボタン用）
export const nav = { stack: [] };
export function back(fallback = '#/') {
  if (nav.stack.length > 1) history.back();
  else location.replace(fallback || '#/');
}

/* ---------- 日付 ---------- */
const WD = ['日', '月', '火', '水', '木', '金', '土'];
export const pad = n => String(n).padStart(2, '0');
export function dateKey(d) { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function fmtDate(d, withYear = false) {
  d = new Date(d);
  const y = withYear || d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}年` : '';
  return `${y}${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;
}
export function fmtTime(d) { d = new Date(d); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function fmtDots(d) { d = new Date(d); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; }
export function daysAgo(d) {
  const a = new Date(dateKey(d) + 'T00:00:00'), b = new Date(dateKey(new Date()) + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}
export function relDay(d) {
  const n = daysAgo(d);
  if (n <= 0) return '今日';
  if (n === 1) return '昨日';
  if (n < 30) return `${n}日前`;
  if (n < 365) return `${Math.round(n / 30)}か月前`;
  return `${Math.floor(n / 365)}年前`;
}
export function toLocalInput(d) {
  d = new Date(d);
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- 写真の遅延読み込み ---------- */
// <img data-photo="entryId" data-kind="thumb|full"> を探して URL を差し込む
export function hydratePhotos(root) {
  $$('img[data-photo]', root).forEach(async img => {
    const url = await store.photoUrl(img.dataset.photo, img.dataset.kind || 'thumb');
    img.src = url;
    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
  });
  $$('[data-bgphoto]', root).forEach(async el => {
    const url = await store.photoUrl(el.dataset.bgphoto, el.dataset.kind || 'full');
    el.style.backgroundImage = `url("${url}")`;
    el.classList.add('loaded');
  });
}

/* ---------- トースト ---------- */
export function toast(html, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}

/* ---------- 確認ダイアログ ---------- */
export function confirmDialog({ title, body = '', ok = 'OK', cancel = 'キャンセル', danger = false }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mdt">
        <h3 id="mdt">${esc(title)}</h3>
        ${body ? `<p>${body}</p>` : ''}
        <div class="modal-actions">
          <button class="btn ghost" data-r="0">${esc(cancel)}</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    const done = v => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 250); resolve(v); };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (b) done(b.dataset.r === '1');
      else if (e.target === wrap) done(false);
    });
  });
}

/* ---------- 下から出るシート ---------- */
export function sheet(html, { onMount } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 300); };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  if (onMount) onMount(wrap.querySelector('.sheet'), close);
  return close;
}

export function topbar({ title = '', left = '', right = '', cls = '' }) {
  return `<header class="topbar ${cls}"><div class="tb-l">${left}</div><h1 class="tb-title">${title}</h1><div class="tb-r">${right}</div></header>`;
}
export const backBtn = (to = '') => `<button class="icon-btn" data-back="${esc(to)}" aria-label="戻る">${icon('back')}</button>`;

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('コピーしました'); }
  catch { toast(esc(text)); }
}

/** 標本番号の表示（サンプルの色は番号なし） */
export function specNo(c) {
  if (c.sample) return 'サンプル';
  return c.no ? 'No.' + String(c.no).padStart(3, '0') : '';
}

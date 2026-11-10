// 色でめぐる夜：ひとつの色から、似た色をたどって過去の夜を次々にめぐるスライドショー
import { store } from './store.js';
import { deltaE, inkFor, oklch } from './colors.js';
import { esc, fmtDate, relDay } from './ui.js';
import { icon } from './icons.js';

const MAX_STEPS = 8;
const CHAIN_LIMIT = 24; // これより遠い色にはつながない

export function buildChain(start) {
  const all = store.allColors();
  const chain = [start];
  const used = new Set([start.entryId]);
  let cur = start;
  while (chain.length < MAX_STEPS) {
    const next = all
      .filter(c => !used.has(c.entryId))
      .map(c => ({ c, d: deltaE(c.rgb, cur.rgb) }))
      .filter(x => x.d <= CHAIN_LIMIT)
      .sort((a, b) => a.d - b.d)[0];
    if (!next) break;
    chain.push(next.c); used.add(next.c.entryId); cur = next.c;
  }
  return chain;
}

export async function openJourney(start) {
  const all = store.allColors();
  if (!all.length) return;
  if (!start) {
    // 暗すぎない、色味のある色からはじめると旅が楽しくなる
    const vivid = all.filter(c => { const o = oklch(c.rgb); return o.L > 0.4 && o.C > 0.04; });
    const pool = vivid.length ? vivid : all;
    start = pool[Math.floor(Math.random() * pool.length)];
  }
  const chain = buildChain(start);
  const urls = await Promise.all(chain.map(c => store.photoUrl(c.entryId, 'full')));

  const el = document.createElement('div');
  el.className = 'journey';
  el.innerHTML = `
    <div class="jn-stage" id="jnStage"></div>
    <div class="jn-top">
      <div class="jn-dots">${chain.map((_, i) => `<i data-i="${i}"></i>`).join('')}<i data-i="${chain.length}"></i></div>
      <button class="icon-btn" id="jnClose" aria-label="閉じる">${icon('close')}</button>
    </div>
    <div class="jn-cap" id="jnCap"></div>
    <p class="jn-hint">画面に触れると次の夜へ</p>`;
  document.body.appendChild(el);
  document.body.classList.add('journeying');
  requestAnimationFrame(() => el.classList.add('show'));

  let i = -1, timer = null;
  const stage = el.querySelector('#jnStage'), cap = el.querySelector('#jnCap');
  const close = () => { clearTimeout(timer); el.classList.remove('show'); document.body.classList.remove('journeying'); setTimeout(() => el.remove(), 400); };

  const showSlide = (k) => {
    i = k;
    el.querySelectorAll('.jn-dots i').forEach((d, n) => d.classList.toggle('on', n <= i));
    clearTimeout(timer);
    if (i >= chain.length) return showEnd();
    const c = chain[i], prev = chain[i - 1];
    const slide = document.createElement('div');
    slide.className = 'jn-slide';
    slide.style.backgroundImage = `url("${urls[i]}")`;
    slide.style.setProperty('--ox', `${c.x * 100}%`);
    slide.style.setProperty('--oy', `${c.y * 100}%`);
    slide.innerHTML = `<span class="jn-mark" style="left:${c.x * 100}%;top:${c.y * 100}%;background:${c.hex}"></span>`;
    stage.appendChild(slide);
    requestAnimationFrame(() => slide.classList.add('in'));
    [...stage.children].slice(0, -1).forEach(o => { o.classList.add('out'); setTimeout(() => o.remove(), 1200); });
    cap.innerHTML = `
      ${prev ? `<p class="jn-link"><i style="background:${prev.hex}"></i>${icon('right', 14)}<i style="background:${c.hex}"></i> 似た色をたどって</p>` : '<p class="jn-link">この色からはじめます</p>'}
      <div class="jn-color"><span class="jn-sw" style="background:${c.hex}"></span>
        <div><strong>${esc(c.nickname || c.name)}</strong><small>${relDay(c.entry.createdAt)} ・ ${fmtDate(c.entry.createdAt)}</small><small>「${esc(c.entry.title || '無題の夜')}」</small></div>
      </div>`;
    cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in');
    timer = setTimeout(() => showSlide(i + 1), 4200);
  };

  const showEnd = () => {
    [...stage.children].forEach(o => { o.classList.add('out'); setTimeout(() => o.remove(), 1200); });
    const grad = chain.length > 1 ? `linear-gradient(180deg, ${chain.map(c => c.hex).join(', ')})` : chain[0].hex;
    cap.innerHTML = `
      <div class="jn-end">
        <div class="jn-ribbon" style="background:${grad}"></div>
        <p class="jn-end-title">${chain.length > 1 ? `${chain.length}つの夜が、<br>似た色でつながっていました。` : 'この色に似た色には、<br>まだ出会っていません。'}</p>
        <div class="jn-end-list">${chain.map(c => `<button data-to="#/color/${c.entryId}/${c.id}"><i style="background:${c.hex}"></i><span>${esc(c.nickname || c.name)}</span><small>${fmtDate(c.entry.createdAt)}</small></button>`).join('')}</div>
        <div class="jn-end-actions"><button class="btn ghost" id="jnAgain">別の色で</button><button class="btn primary" id="jnDone">閉じる</button></div>
      </div>`;
    cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in', 'end');
    el.querySelector('.jn-hint').style.display = 'none';
    cap.querySelector('#jnDone').onclick = e => { e.stopPropagation(); close(); };
    cap.querySelector('#jnAgain').onclick = e => { e.stopPropagation(); close(); setTimeout(() => openJourney(), 420); };
    cap.querySelectorAll('[data-to]').forEach(b => b.onclick = e => { e.stopPropagation(); close(); location.hash = b.dataset.to; });
  };

  el.addEventListener('click', e => {
    if (e.target.closest('#jnClose')) { close(); return; }
    if (i < chain.length && !e.target.closest('.jn-end')) showSlide(i + 1);
  });
  showSlide(0);
}


// 「色」：カラーコレクション（色の星図・標本箱・夜のパレット）と、色の詳細（似た色との再会）
import { store } from '../store.js';
import { FAMILIES, familyLabel, oklch, rgbToOklab, nearestName, inkFor, deltaE, hexOfName, hexToRgb } from '../colors.js';
import { openJourney } from '../journey.js';
import { esc, fmtDate, fmtDots, relDay, topbar, backBtn, $, $$, nav, copyText, sheet, toast, hydratePhotos } from '../ui.js';
import { icon } from '../icons.js';
import { rerender } from '../main.js';

/* ---------- 傾向の計算 ---------- */
function tendency(colors) {
  const counts = FAMILIES.map(f => ({ ...f, list: colors.filter(c => c.family === f.key) }))
    .filter(f => f.list.length)
    .sort((a, b) => b.list.length - a.list.length);
  // 全色を OKLab 上で平均した「あなたの夜の色」
  let avg = null;
  if (colors.length) {
    const labs = colors.map(c => rgbToOklab(c.rgb));
    const m = [0, 1, 2].map(i => labs.reduce((s, l) => s + l[i], 0) / labs.length);
    avg = oklabToRgb(m);
  }
  // 最近30日で増えている系統
  const now = Date.now();
  const recent = colors.filter(c => now - new Date(c.entry.createdAt) < 30 * 86400000);
  let rising = null;
  if (recent.length >= 3 && colors.length > recent.length) {
    const share = (list, key) => list.filter(c => c.family === key).length / list.length;
    const older = colors.filter(c => !recent.includes(c));
    rising = FAMILIES.map(f => ({ f, diff: share(recent, f.key) - share(older, f.key) }))
      .sort((a, b) => b.diff - a.diff)[0];
    if (rising.diff < 0.15) rising = null;
  }
  return { counts, avg, rising, recentCount: recent.length };
}
function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  return lin.map(v => {
    v = Math.max(0, Math.min(1, v));
    return Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
  });
}
const hexOf = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

/* ---------- 星図の座標 ---------- */
function starPos(c) {
  const { L, C, H } = oklch(c.rgb);
  let r;
  if (c.family === 'neutral') r = 0.06 + (1 - L) * 0.14;
  else r = 0.26 + Math.min(C / 0.2, 1) * 0.62;
  const a = (H - 90) * Math.PI / 180;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export async function renderCollection(root, _p, query) {
  const colors = store.allColors();
  const tab = ['sky', 'box', 'palette', 'cal', 'find'].includes(query.tab) ? query.tab : 'sky';
  const sort = query.sort || 'new';
  const nights = new Set(colors.map(c => c.entryId)).size;
  const t = tendency(colors);

  const setQuery = (patch) => {
    const p = new URLSearchParams({ tab, sort, ...patch });
    const raw = '/colors?' + p.toString();
    history.replaceState(null, '', '#' + raw);
    nav.stack[nav.stack.length - 1] = raw;
    rerender();
  };

  if (!colors.length) {
    root.innerHTML = `${topbar({ title: '色' })}
      <div class="empty">${icon('palette', 36)}<p>まだ採集した色はありません。</p>
      <p class="small-note">夜景の写真の中で、綺麗だと思った場所に触れると、その色を採集できます。</p>
      <button class="btn primary" data-go="#/new">${icon('drop', 18)} 夜景を残す</button></div>`;
    return;
  }

  // スペクトラム帯：系統ごとの割合を、実際の色の細い帯で描く
  const band = t.counts.map(f => {
    const sorted = [...f.list].sort((a, b) => oklch(b.rgb).L - oklch(a.rgb).L);
    return `<div class="band-seg" style="flex:${f.list.length}">${sorted.map(c => `<i style="background:${c.hex}"></i>`).join('')}</div>`;
  }).join('');
  const top = t.counts[0];

  root.innerHTML = `
  ${topbar({ title: '色', right: `<button class="icon-btn" data-tab="find" aria-label="色でさがす">${icon('search')}</button>` })}
  <section class="col-hero pad-x">
    <p class="ch-count"><strong>${colors.length}</strong><span>色</span></p>
    <p class="ch-sub">${nights}つの夜から採集した色</p>
    <div class="band" aria-label="系統ごとの割合">${band}</div>
    <div class="band-legend">${t.counts.map(f => `<span><i style="background:${f.sample}"></i>${f.label} ${f.list.length}</span>`).join('')}</div>
    <div class="insight">
      ${t.avg ? `<div class="avg-swatch" style="background:${hexOf(t.avg)}"></div>` : ''}
      <div>
        <p>いちばん多いのは<strong>${esc(top.label)}</strong>の系統。${colors.length}色のうち${top.list.length}色です。</p>
        ${t.rising ? `<p>最近は<strong>${esc(t.rising.f.label)}</strong>の色に、よく目が留まっているようです。</p>` : ''}
        ${t.avg ? `<p class="small-note">これまでの色をすべて混ぜると「${esc(nearestName(t.avg))}」に近い色になります。</p>` : ''}
      </div>
    </div>
    <button class="journey-btn" id="journeyBtn">
      <span class="jb-orbs">${colors.slice(-5).map(c => `<i style="background:${c.hex}"></i>`).join('')}</span>
      <span class="jb-txt"><strong>色でめぐる夜</strong><small>似た色をたどって、過去の夜を順に見ていきます</small></span>
      ${icon('right', 18)}
    </button>
  </section>

  <div class="pad-x">
    <div class="seg four" role="tablist">
      <button role="tab" class="${tab === 'sky' ? 'on' : ''}" data-tab="sky">${icon('constellation', 18)}<span>星図</span></button>
      <button role="tab" class="${tab === 'box' ? 'on' : ''}" data-tab="box">${icon('grid', 18)}<span>標本箱</span></button>
      <button role="tab" class="${tab === 'palette' ? 'on' : ''}" data-tab="palette">${icon('stripes', 18)}<span>パレット</span></button>
      <button role="tab" class="${tab === 'cal' ? 'on' : ''}" data-tab="cal">${icon('calendar', 18)}<span>色の暦</span></button>
    </div>
  </div>
  <div id="colBody"></div>`;

  $$('[data-tab]', root).forEach(b => b.onclick = () => setQuery({ tab: b.dataset.tab }));
  const body = $('#colBody', root);

  if (tab === 'sky') drawSky(body, colors);
  if (tab === 'box') drawBox(body, colors, sort, setQuery);
  if (tab === 'palette') drawPalettes(body);
  if (tab === 'cal') drawMonths(body, colors);
  if (tab === 'find') drawFind(body, colors, query.hex);
  $('#journeyBtn', root).onclick = () => openJourney();
  if (tab === 'find') { root.querySelector('.col-hero').style.display = 'none'; root.querySelector('.seg.four').parentElement.style.display = 'none'; }
}

/* ---------- 色の暦：月ごとの色の帯 ---------- */
function drawMonths(body, colors) {
  const months = new Map();
  colors.forEach(c => {
    const d = new Date(c.entry.createdAt);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(k)) months.set(k, []);
    months.get(k).push(c);
  });
  const keys = [...months.keys()].sort().reverse();
  body.innerHTML = `
    <div class="pad-x">
      <p class="small-note">月ごとに、採集した色を日付の順に並べています。季節や時期によって、惹かれる色が変わっていくのが見えてきます。</p>
      ${keys.map(k => {
        const list = months.get(k).sort((a, b) => a.entry.createdAt.localeCompare(b.entry.createdAt));
        const [y, m] = k.split('-');
        const nights = new Set(list.map(c => c.entryId)).size;
        const fams = FAMILIES.map(f => ({ f, n: list.filter(c => c.family === f.key).length })).sort((a, b) => b.n - a.n);
        const fam = fams[0].n >= 2 && fams[0].n > fams[1].n ? fams[0] : null;
        return `
        <section class="month-row">
          <div class="mr-head"><strong>${+m}月</strong><small>${y}年 ・ ${nights}つの夜 ・ ${list.length}色</small></div>
          <div class="mr-band">${list.map(c => `<button style="background:${c.hex}" data-go="#/color/${c.entryId}/${c.id}" aria-label="${esc(c.name)}"></button>`).join('')}</div>
          ${fam ? `<p class="mr-note">いちばん多かったのは${esc(fam.f.label)}の系統</p>` : '<p class="mr-note">いろいろな色に出会った月</p>'}
        </section>`;
      }).join('')}
    </div>`;
}

/* ---------- 色でさがす ---------- */
const FIND_PRESETS = ['漆黒', '濃紺', '紺青', '瑠璃色', '群青', '薄花色', '藍鼠', '浅葱色', '桔梗色', '菫色', '藤色', 'ラベンダー',
  '紫', '鴇色', 'コーラルピンク', '紅色', '朱色', '橙色', '琥珀色', '山吹色', '卵色', 'クリーム色', '月白', '緑', '萌黄', '鈍色', '焦茶', '銀鼠'];
function drawFind(body, colors, hex) {
  const target = hex ? '#' + hex.replace('#', '') : null;
  let results = [];
  if (target) {
    const rgb = hexToRgb(target);
    results = colors.map(c => ({ ...c, d: deltaE(c.rgb, rgb) })).filter(c => c.d <= 14).sort((a, b) => a.d - b.d);
  }
  body.innerHTML = `
    <div class="pad-x">
      <button class="link-sm back-link" data-tab="sky">${icon('back', 14)} コレクションへ</button>
      <h2 class="find-title">色でさがす</h2>
      <p class="small-note">色を選ぶと、その色に近い色を採集した夜が見つかります。「あの青い夜、いつだったかな」というときに。</p>
      <div class="find-grid">
        ${FIND_PRESETS.map(n => { const h = hexOfName(n); return `<button class="fg ${target && target.toUpperCase() === h ? 'on' : ''}" style="background:${h}" data-hex="${h.slice(1)}" aria-label="${n}" title="${n}"></button>`; }).join('')}
        <label class="fg custom" title="自由に選ぶ">${icon('plus', 18)}<input type="color" id="freeColor" value="${target || '#4C6CB3'}"></label>
      </div>
      ${target ? `
        <div class="find-head"><span style="background:${target}"></span><div><strong>${esc(nearestName(hexToRgb(target)))}</strong><small>${results.length ? `${new Set(results.map(r => r.entryId)).size}つの夜で、近い色に出会っています` : 'この色に近い色には、まだ出会っていません'}</small></div></div>
        <div class="reunions">
          ${results.map(s => `
          <button class="reunion" data-go="#/color/${s.entryId}/${s.id}">
            <div class="ru-photo" data-bgphoto="${s.entryId}" style="background-position:${s.x * 100}% ${s.y * 100}%">
              <span class="spot-mark sm" style="left:${s.x * 100}%;top:${s.y * 100}%;background:${s.hex}"></span>
            </div>
            <div class="ru-pair"><i style="background:${target}"></i><i style="background:${s.hex}"></i></div>
            <div class="ru-txt"><strong>${esc(s.nickname || s.name)}</strong><small>${fmtDate(s.entry.createdAt)} ・ ${esc(s.entry.title || '無題の夜')}</small></div>
          </button>`).join('')}
        </div>` : ''}
    </div>`;
  const go = h => { location.hash = `#/colors?tab=find&hex=${h.replace('#', '')}`; };
  $$('[data-hex]', body).forEach(b => b.onclick = () => go(b.dataset.hex));
  $('#freeColor', body).onchange = e => go(e.target.value);
  $$('[data-tab]', body).forEach(b => b.onclick = () => { location.hash = '#/colors'; });
  hydratePhotos(body);
}

/* ---------- 星図 ---------- */
function drawSky(body, colors) {
  const S = 340, R = S / 2;
  const P = c => { const p = starPos(c); return { x: R + p.x * (R - 18), y: R + p.y * (R - 18) }; };
  const byEntry = new Map();
  colors.forEach(c => { if (!byEntry.has(c.entryId)) byEntry.set(c.entryId, []); byEntry.get(c.entryId).push(c); });
  const lines = [...byEntry.entries()].map(([id, cs]) => {
    if (cs.length < 2) return '';
    const pts = cs.map(P);
    return `<polyline class="cline" data-entry="${id}" points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>`;
  }).join('');
  const labels = [['赤', 20], ['オレンジ', 60], ['黄', 98], ['緑', 150], ['青', 240], ['紫', 305]].map(([l, h]) => {
    const a = (h - 90) * Math.PI / 180;
    return `<text x="${R + Math.cos(a) * (R - 4)}" y="${R + Math.sin(a) * (R - 4)}" class="slabel">${l}</text>`;
  }).join('');
  const dots = colors.map((c, i) => {
    const p = P(c);
    return `<g class="star" data-i="${i}" style="--d:${(i % 7) * 0.6}s">
      <circle cx="${p.x}" cy="${p.y}" r="11" fill="${c.hex}" class="halo"/>
      <circle cx="${p.x}" cy="${p.y}" r="5.5" fill="${c.hex}" class="core"/>
      <circle cx="${p.x}" cy="${p.y}" r="16" fill="transparent" class="hit"/>
    </g>`;
  }).join('');

  body.innerHTML = `
    <div class="sky-map">
      <div class="sky-ring"></div>
      <svg viewBox="0 0 ${S} ${S}" role="img" aria-label="採集した色の星図">
        <circle cx="${R}" cy="${R}" r="${R * 0.26}" class="orbit"/>
        <circle cx="${R}" cy="${R}" r="${R * 0.58}" class="orbit"/>
        <circle cx="${R}" cy="${R}" r="${R - 18}" class="orbit"/>
        ${labels}
        <g class="clines">${lines}</g>
        ${dots}
      </svg>
    </div>
    <p class="small-note center pad-x">色相をめぐる円の上に、採集した色を星のように置いています。<br>中心に近いほど落ち着いた色、外側ほど鮮やかな色。似た色は近くに集まります。<br>線でつながっているのは、同じ夜に採集した色です。</p>
    <div id="starInfo" class="star-info" aria-live="polite"><p class="small-note center">星に触れてみてください。</p></div>`;

  const info = $('#starInfo', body);
  $$('.star', body).forEach(g => g.addEventListener('click', () => {
    const c = colors[+g.dataset.i];
    $$('.star', body).forEach(s => s.classList.toggle('sel', s === g));
    $$('.cline', body).forEach(l => l.classList.toggle('on', l.dataset.entry === c.entryId));
    $$('.star', body).forEach(s => s.classList.toggle('same', colors[+s.dataset.i].entryId === c.entryId));
    const sim = store.similarTo(c).length;
    info.innerHTML = `
      <button class="si-card" data-go="#/color/${c.entryId}/${c.id}">
        <span class="si-sw" style="background:${c.hex}"></span>
        <span class="si-txt">
          <strong>${esc(c.nickname || c.name)}</strong>
          <small>${fmtDate(c.entry.createdAt)} ・ ${esc(c.entry.title || '無題の夜')}</small>
          ${sim ? `<small class="si-sim">${icon('sparkle', 12)} 別の夜に似た色が${sim}つ</small>` : ''}
        </span>
        ${icon('right', 18)}
      </button>`;
  }));
}

/* ---------- 標本箱 ---------- */
function drawBox(body, colors, sort, setQuery) {
  const tile = c => `
    <button class="specimen" data-go="#/color/${c.entryId}/${c.id}">
      <span class="sp-sw" style="background:${c.hex}"></span>
      <span class="sp-label"><em>No.${String(c.no).padStart(3, '0')}</em>${esc(c.nickname || c.name)}</span>
    </button>`;
  let inner = '';
  if (sort === 'family') {
    inner = FAMILIES.map(f => {
      const list = colors.filter(c => c.family === f.key).sort((a, b) => a.hue - b.hue);
      if (!list.length) return '';
      return `<h4 class="fam-head"><i style="background:${f.sample}"></i>${f.label}<small>${list.length}</small></h4><div class="box-grid">${list.map(tile).join('')}</div>`;
    }).join('');
  } else {
    const list = sort === 'hue' ? [...colors].sort((a, b) => a.hue - b.hue) : [...colors].reverse();
    inner = `<div class="box-grid">${list.map(tile).join('')}</div>`;
  }
  body.innerHTML = `
    <div class="pad-x">
      <div class="sort-row">
        <span>並べ方</span>
        ${[['new', '採集順'], ['hue', '色相'], ['family', '系統別']].map(([k, l]) => `<button class="chip sm ${sort === k ? 'on' : ''}" data-sort="${k}">${l}</button>`).join('')}
      </div>
      ${inner}
      <p class="small-note center">同じような色でも、別の夜に出会った色はそれぞれ一つの標本として残ります。</p>
    </div>`;
  $$('[data-sort]', body).forEach(b => b.onclick = () => setQuery({ sort: b.dataset.sort }));
}

/* ---------- 夜ごとのパレット ---------- */
function drawPalettes(body) {
  const list = store.entries.filter(e => (e.colors || []).length);
  const none = store.entries.length - list.length;
  body.innerHTML = `
    <div class="pad-x">
      ${list.map(e => `
        <article class="palette-card" data-go="#/entry/${e.id}" role="link">
          <div class="pc-bars">${e.colors.map(c => `<i style="background:${c.hex}"><span style="color:${inkFor(c.rgb)}">${esc(c.nickname || c.name)}</span></i>`).join('')}</div>
          <div class="pc-meta">
            <img data-photo="${e.id}" alt="">
            <div><strong>${esc(e.title || '無題の夜')}</strong><small>${fmtDate(e.createdAt)}</small></div>
            ${icon('right', 18)}
          </div>
        </article>`).join('')}
      ${none ? `<p class="small-note center">色を採集していない夜が${none}つあります。</p>` : ''}
    </div>`;
}

/* ---------- 色の詳細 ---------- */
export async function renderColor(root, [entryId, colorId]) {
  const c = store.color(entryId, colorId);
  if (!c) { root.innerHTML = `${topbar({ left: backBtn('#/colors') })}<p class="pad">この色は見つかりませんでした。</p>`; return; }
  const e = c.entry;
  const sim = store.similarTo(c);
  const ink = inkFor(c.rgb);
  const siblings = store.allColors().filter(x => x.entryId === e.id && x.id !== c.id);

  root.innerHTML = `
  ${topbar({ left: backBtn('#/colors'), cls: 'clear float' })}
  <section class="color-hero" style="--c:${c.hex};color:${ink}">
    <p class="spec-tag">No.${String(c.no).padStart(3, '0')} ・ ${fmtDots(e.createdAt)}</p>
    <h1 class="cname">${esc(c.nickname || c.name)}</h1>
    ${c.nickname ? `<p class="csub">近い色名：${esc(c.name)}</p>` : ''}
    <div class="ccodes">
      <button class="code" id="copyHex">${c.hex} ${icon('copy', 14)}</button>
      <span class="code">RGB ${c.rgb.join(', ')}</span>
      <span class="code">${familyLabel(c.family)}の系統</span>
    </div>
    <div class="hero-actions">
      <button class="nick-btn" id="journeyFrom">${icon('constellation', 14)} この色から夜をめぐる</button>
    <button class="nick-btn" id="nickBtn">${icon('edit', 14)} ${c.nickname ? '呼び名を変える' : '自分だけの呼び名をつける'}</button>
    </div>
  </section>

  <section class="pad">
    <h3 class="block-title">${icon('pin', 16)} この色に出会った場所</h3>
    <button class="spot" data-go="#/entry/${e.id}">
      <div class="spot-zoom" data-bgphoto="${e.id}" style="background-position:${c.x * 100}% ${c.y * 100}%">
        <span class="spot-mark" style="left:${c.x * 100}%;top:${c.y * 100}%;background:${c.hex}"></span>
      </div>
      <div class="spot-cap">
        <img data-photo="${e.id}" alt="">
        <div><strong>${esc(e.title || '無題の夜')}</strong><small>${fmtDate(e.createdAt, true)}</small></div>
        ${icon('right', 18)}
      </div>
    </button>

    ${siblings.length ? `
    <h3 class="block-title mt">同じ夜の色</h3>
    <div class="sib-row">
      <span class="sib cur" style="background:${c.hex}"></span>
      ${siblings.map(s => `<button class="sib" style="background:${s.hex}" data-go="#/color/${s.entryId}/${s.id}" aria-label="${esc(s.name)}"></button>`).join('')}
    </div>` : ''}

    <h3 class="block-title mt">${icon('sparkle', 16)} 似た色との再会</h3>
    ${sim.length ? `
      <p class="reunion-lead">違う場所、違う時間の夜でも、<br>あなたは似た色に惹かれていました。</p>
      <div class="reunions">
        ${sim.map(s => `
        <button class="reunion" data-go="#/color/${s.entryId}/${s.id}">
          <div class="ru-photo" data-bgphoto="${s.entryId}" style="background-position:${s.x * 100}% ${s.y * 100}%">
            <span class="spot-mark sm" style="left:${s.x * 100}%;top:${s.y * 100}%;background:${s.hex}"></span>
          </div>
          <div class="ru-pair"><i style="background:${c.hex}"></i><i style="background:${s.hex}"></i></div>
          <div class="ru-txt">
            <strong>${esc(s.nickname || s.name)}</strong>
            <small>${relDay(s.entry.createdAt)} ・ ${esc(s.entry.title || '無題の夜')}</small>
          </div>
        </button>`).join('')}
      </div>
      <p class="small-note">人の目の感じ方に近い色空間（OKLab）で、近い色を探しています。</p>`
    : `<p class="small-note">似た色には、まだ出会っていません。いつかの夜に、また見つかるかもしれません。</p>`}
  </section>`;

  $('#copyHex', root).onclick = () => copyText(c.hex);
  $('#nickBtn', root).onclick = () => nicknameSheet(e, c);
  $('#journeyFrom', root).onclick = () => openJourney(c);
}

export function nicknameSheet(e, c, onSaved) {
  sheet(`
    <h3 class="sheet-title">この色の呼び名</h3>
    <p class="small-note">色名は近い名前を自動で選んでいます。あなたにとってのこの色の名前があれば、つけてください。</p>
    <div class="nick-preview"><span style="background:${c.hex}"></span><input id="nickIn" maxlength="24" placeholder="例：駅前の信号の青" value="${esc(c.nickname || '')}"></div>
    <div class="sheet-actions"><button class="btn ghost" data-close>やめる</button><button class="btn primary" id="nickSave">保存</button></div>`, {
    onMount(el, close) {
      const input = $('#nickIn', el);
      setTimeout(() => input.focus(), 250);
      $('#nickSave', el).onclick = async () => {
        if (!e) { onSaved && onSaved(input.value.trim()); close(); return; }
        const entry = { ...e, colors: e.colors.map(x => x.id === c.id ? { ...x, nickname: input.value.trim() } : x), updatedAt: new Date().toISOString() };
        await store.save(entry);
        close(); toast('呼び名を保存しました');
        rerender();
      };
    },
  });
}

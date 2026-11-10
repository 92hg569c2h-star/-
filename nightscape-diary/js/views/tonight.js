// 「今夜」：今夜の空（天気・日没・月の時刻表）、今日の手紙、色との再会 ／ 手紙の一覧・本文
import { store } from '../store.js';
import { LETTERS, THEMES, letterById, pickLetter, openingLine } from '../letters.js';
import { bucketOf, hm } from '../sky.js';
import { hexOfName } from '../colors.js';
import { esc, dateKey, fmtDate, relDay, topbar, backBtn } from '../ui.js';
import { icon } from '../icons.js';

const GREETING = {
  day: '今夜のための手紙が届いています。',
  dusk: 'もうすぐ、空の色が変わる時間です。',
  night: 'こんばんは。今日もおつかれさまでした。',
};

/** 手紙を今日の空で書き上げる（届いた時点の内容を保存しておく） */
function render(letter, sky, bucket) {
  const b = letter.build(sky);
  return { ...b, opening: openingLine(sky, bucket), city: sky.city, weather: sky.weather ? sky.weather.label : null };
}

/** 今日の手紙。空模様が変わったら、その日の手紙も差し替える */
async function todaysLetter(sky) {
  const now = new Date();
  const today = dateKey(now);
  const bucket = bucketOf(sky, now);
  const received = { ...(store.meta.received || {}) };
  const cond = sky.weather ? sky.weather.cond : null;
  const cur = received[today];
  if (cur && cur.rendered && (cur.cond || null) === cond && ((cur.bucket === 'night') === (bucket === 'night')) && letterById(cur.id)) {
    return { letter: letterById(cur.id), rendered: cur.rendered, bucket };
  }
  const recent = Object.keys(received).filter(k => k !== today).sort().slice(-7).map(k => received[k].id);
  const letter = pickLetter(today, sky, bucket, recent);
  const rendered = render(letter, sky, bucket);
  received[today] = { id: letter.id, cond, bucket, rendered, at: now.toISOString() };
  await store.setMeta('received', received);
  return { letter, rendered, bucket };
}

function hashNum(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

/** 今夜の時刻表（日没前1時間〜日没後5時間） */
function skyTimeline(sky, now) {
  const { sunset, blueStart, blueEnd, dark } = sky.sun;
  if (!sunset) return '';
  const t0 = sunset.getTime() - 60 * 60000, t1 = sunset.getTime() + 5 * 3600000;
  const pct = d => Math.max(0, Math.min(100, (d.getTime() - t0) / (t1 - t0) * 100));
  const grad = `linear-gradient(90deg, #7FA3CF 0%, #E9B07E ${pct(sunset) - 4}%, #D98C83 ${pct(sunset)}%, #8E6FB3 ${pct(blueStart)}%, #3F55A8 ${(pct(blueStart) + pct(blueEnd)) / 2}%, #23306B ${pct(blueEnd)}%, #141B40 ${pct(dark)}%, #0B1026 100%)`;
  const ticks = [];
  for (let h = new Date(t0); h.getTime() <= t1; h = new Date(h.getTime() + 3600000)) {
    const d = new Date(h); d.setMinutes(0, 0, 0);
    if (d.getTime() >= t0) ticks.push(`<span class="tl-tick" style="left:${pct(d)}%">${d.getHours()}</span>`);
  }
  const marks = [
    `<span class="tl-mark sun" style="left:${pct(sunset)}%"><i></i><b>日没 ${hm(sunset)}</b></span>`,
  ];
  if (sky.moon.mark && sky.moon.mark.time.getTime() < t1) marks.push(`<span class="tl-mark moon" style="left:${pct(sky.moon.mark.time)}%"><i></i><b>${sky.moon.mark.label} ${hm(sky.moon.mark.time)}</b></span>`);
  const nowMark = now.getTime() > t0 && now.getTime() < t1 ? `<span class="tl-now" style="left:${pct(now)}%"><b>いま</b></span>` : '';
  return `
    <div class="timeline">
      <div class="tl-bar" style="background:${grad}">
        <span class="tl-blue" style="left:${pct(blueStart)}%;width:${pct(blueEnd) - pct(blueStart)}%"></span>
        ${nowMark}
      </div>
      <div class="tl-marks">${marks.join('')}</div>
      <div class="tl-ticks">${ticks.join('')}</div>
    </div>`;
}

function moonGlyph(moon) {
  // 月の満ち欠けを、影の位置で表す小さな絵
  const age = moon.age, k = Math.cos(2 * Math.PI * age / 29.53); // 1:新月 → -1:満月
  const waxing = age < 14.77;
  const rx = Math.abs(k) * 10;
  const lit = '#F3E3A6', dark = '#232B52';
  const d = waxing
    ? `M12 2 A10 10 0 0 1 12 22 A${rx} 10 0 0 ${k > 0 ? 0 : 1} 12 2Z`
    : `M12 2 A10 10 0 0 0 12 22 A${rx} 10 0 0 ${k > 0 ? 1 : 0} 12 2Z`;
  return `<svg class="moon-glyph" viewBox="0 0 24 24" width="30" height="30"><circle cx="12" cy="12" r="10" fill="${dark}"/><path d="${d}" fill="${lit}"/></svg>`;
}

function skyCard(sky, now) {
  const w = sky.weather;
  const src = sky.source === 'open-meteo' ? '天気：Open-Meteo' : sky.source === 'manual' ? '天気：手動設定' : '';
  return `
  <section class="sky-card">
    <div class="sc-top">
      <div class="sc-weather">
        ${w ? `<strong>${esc(w.label)}</strong>${w.temp != null ? `<span>${w.temp}℃</span>` : ''}` : '<strong class="muted">天気を取得できませんでした</strong>'}
        <em>${esc(sky.city)}</em>
      </div>
      <div class="sc-moon">${moonGlyph(sky.moon)}<span>月齢 ${sky.moon.age}<br>${esc(sky.moon.name)}</span></div>
    </div>
    ${skyTimeline(sky, now)}
    <dl class="sc-rows">
      <div><dt>空が青く染まる</dt><dd>${sky.t.blue}</dd></div>
      <div><dt>暗くなる</dt><dd>${sky.t.dark}ごろ</dd></div>
      <div class="wide"><dt>月</dt><dd>${esc(sky.moon.when)}</dd></div>
    </dl>
    <p class="sc-src">${src ? esc(src) + ' ・ ' : ''}日没と月は計算による目安です ・ <a href="#/settings">地域を変える</a></p>
  </section>`;
}

export async function renderTonight(root) {
  const sky = await store.getSky();
  const now = new Date();
  const { letter, rendered, bucket } = await todaysLetter(sky);
  const colors = store.allColors();

  const old = colors.filter(c => (now - new Date(c.entry.createdAt)) > 6 * 86400000);
  const pool = old.length ? old : colors;
  const memory = pool.length ? pool[hashNum(dateKey(now)) % pool.length] : null;
  const recent = store.entries.slice(0, 6);

  root.innerHTML = `
  <section class="tonight">
    <div class="sky-head">
      <p class="date">${fmtDate(now)}</p>
      <p class="greet">${GREETING[bucket].split(/(?<=。)/).filter(Boolean).map(t => `<span>${t}</span>`).join('')}</p>
    </div>

    <article class="letter-card" data-go="#/letter/${letter.id}?d=${dateKey(now)}" role="link" tabindex="0">
      <div class="lc-top"><span class="seal">${icon('letter', 16)}</span><span class="lc-theme">今日の手紙 ・ ${esc(letter.theme)}</span></div>
      <h2 class="lc-title">${esc(rendered.title)}</h2>
      <p class="lc-body">${esc(rendered.opening)}</p>
      <div class="lc-colors">${letter.colors.map(n => `<i style="background:${hexOfName(n)}" title="${esc(n)}"></i>`).join('')}<span>見つけやすい色</span></div>
      <span class="lc-open">ひらく ${icon('right', 16)}</span>
    </article>

    ${skyCard(sky, now)}

    ${memory ? `
    <section class="block">
      <h3 class="block-title">${icon('sparkle', 16)} 色との再会</h3>
      <article class="memory-card" data-go="#/color/${memory.entryId}/${memory.id}" role="link">
        <div class="mc-photo" data-bgphoto="${memory.entryId}" style="background-position:${memory.x * 100}% ${memory.y * 100}%">
          <span class="mc-mark" style="left:${memory.x * 100}%;top:${memory.y * 100}%;background:${memory.hex}"></span>
        </div>
        <div class="mc-info">
          <span class="mc-swatch" style="background:${memory.hex}"></span>
          <p class="mc-when">${relDay(memory.entry.createdAt)}の夜</p>
          <p class="mc-name">${esc(memory.nickname || memory.name)}</p>
          <p class="mc-from">「${esc(memory.entry.title || '無題の夜')}」で採集</p>
        </div>
      </article>
    </section>` : ''}

    ${recent.length ? `
    <section class="block">
      <div class="block-head"><h3 class="block-title">最近の夜</h3><a href="#/diary" class="link-sm">日記へ ${icon('right', 14)}</a></div>
      <div class="recent-strip">
        ${recent.map(e => `
          <button class="recent" data-go="#/entry/${e.id}" aria-label="${esc(e.title || '無題の夜')}">
            <img data-photo="${e.id}" alt="">
            <span class="rs-pal">${(e.colors || []).map(c => `<i style="background:${c.hex}"></i>`).join('')}</span>
          </button>`).join('')}
      </div>
    </section>` : ''}

    <a class="row-link" href="#/letters">${icon('letter', 18)}<span>これまでに届いた手紙</span>${icon('right', 16)}</a>

    <p class="closing">綺麗だと思った夜にだけ、ひらいてください。<br>手紙を読むだけの日があっても大丈夫です。</p>
  </section>`;
}

export async function renderLetters(root) {
  const sky = await store.getSky();
  await todaysLetter(sky);
  const received = store.meta.received || {};
  const days = Object.keys(received).sort().reverse();
  const readSet = new Set(store.meta.readLetters || []);
  const receivedIds = new Set(days.map(d => received[d].id));

  root.innerHTML = `
  ${topbar({ title: '手紙', left: backBtn('#/') })}
  <section class="pad">
    <h3 class="block-title">届いた手紙</h3>
    <p class="small-note">アプリをひらいた日に一通ずつ、その日の空に合わせて届きます。届いた手紙は消えずに残ります。</p>
    <ul class="letter-list">
      ${days.map(d => {
        const r = received[d], l = letterById(r.id); if (!l) return '';
        const title = r.rendered ? r.rendered.title : l.id;
        return `<li><a href="#/letter/${l.id}?d=${d}" class="ll-item">
          <span class="ll-date">${fmtDate(d + 'T12:00:00')}${r.rendered && r.rendered.weather ? ` ・ ${esc(r.rendered.weather)}` : ''}</span>
          <span class="ll-title">${esc(title)}</span>
          <span class="ll-theme">${esc(l.theme)}</span></a></li>`;
      }).join('')}
    </ul>

    <h3 class="block-title mt">手紙の引き出し</h3>
    <p class="small-note">すべての手紙を、今日の空の情報で読むことができます。</p>
    ${THEMES.map(t => `
      <div class="drawer">
        <h4>${esc(t)}</h4>
        ${LETTERS.filter(l => l.theme === t).map(l => `
          <a href="#/letter/${l.id}" class="drawer-item ${readSet.has(l.id) ? 'read' : ''}">
            <span>${esc(l.build(sky).title)}</span>
            ${receivedIds.has(l.id) ? '<em>届いた</em>' : ''}
          </a>`).join('')}
      </div>`).join('')}
  </section>`;
}

export async function renderLetter(root, [id], query) {
  const l = letterById(id);
  if (!l) { root.innerHTML = `${topbar({ left: backBtn('#/') })}<p class="pad">手紙が見つかりませんでした。</p>`; return; }
  const read = new Set(store.meta.readLetters || []);
  if (!read.has(id)) { read.add(id); await store.setMeta('readLetters', [...read]); }
  const rec = query.d && (store.meta.received || {})[query.d];
  let r;
  if (rec && rec.id === id && rec.rendered) r = rec.rendered;
  else { const sky = await store.getSky(); r = render(l, sky, bucketOf(sky)); }

  root.innerHTML = `
  ${topbar({ left: backBtn('#/'), cls: 'clear' })}
  <article class="letter-paper">
    <p class="lp-meta">${esc(l.theme)}${rec && rec.id === id ? ` ・ ${fmtDate(query.d + 'T12:00:00')}に届いた手紙` : ''}</p>
    <h1 class="lp-title">${esc(r.title)}</h1>
    <p class="lp-opening">${esc(r.opening)}</p>
    <p class="lp-body">${esc(r.body)}</p>
    <dl class="lp-steps">
      ${r.steps.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
    </dl>
    <div class="lp-colors">
      <span>見つけやすい色</span>
      <div>${l.colors.map(n => `<span class="lpc"><i style="background:${hexOfName(n)}"></i>${esc(n)}</span>`).join('')}</div>
    </div>
    <p class="lp-sign">— 夜景日記より</p>
  </article>
  <div class="letter-actions">
    <p class="small-note center">読むだけで閉じても大丈夫です。<br>綺麗な景色に出会えたら、そのときに残してください。</p>
    <button class="btn primary wide" data-go="#/new?letter=${l.id}">${icon('drop', 18)} この見方で夜景を残す</button>
    <button class="btn ghost wide" data-back="#/">閉じる</button>
  </div>`;
}

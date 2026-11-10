// 「その他」：ホーム画面への追加、使い方、バックアップ、サンプル、アプリについて
import { store } from '../store.js';
import { db } from '../db.js';
import { esc, topbar, $, toast, confirmDialog, sheet } from '../ui.js';
import { icon } from '../icons.js';
import { rerender } from '../main.js';
import { CITIES, WEATHER_LABEL } from '../sky.js';

const APP_VERSION = '1.1.0';

function b64(buf) {
  let s = ''; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(str) {
  const bin = atob(str); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function exportBackup() {
  const entries = store.entries.filter(e => !e.sample);
  if (!entries.length) { toast('書き出せる記録がまだありません（サンプルは含みません）'); return; }
  const photos = [];
  for (const e of entries) {
    const p = await db.getPhoto(e.id);
    if (p) photos.push({ id: e.id, type: p.full.type, full: b64(await p.full.arrayBuffer()), thumbType: p.thumb.type, thumb: b64(await p.thumb.arrayBuffer()) });
  }
  const data = { app: 'nightscape-diary', version: 1, exportedAt: new Date().toISOString(), entries, photos, meta: { customTags: store.meta.customTags || [], readLetters: store.meta.readLetters || [], received: store.meta.received || {} } };
  const d = new Date();
  const name = `nightscape-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  // iPhone では共有シートから「ファイルに保存」できる
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '夜景日記のバックアップ' }); return; }
    catch (err) { if (err && err.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`${entries.length}件の記録を書き出しました`);
}

async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('ファイルを読み込めませんでした'); return; }
  if (data.app !== 'nightscape-diary' || !Array.isArray(data.entries)) { toast('夜景日記のバックアップではないようです'); return; }
  const existing = new Set(store.entries.map(e => e.id));
  const photos = new Map((data.photos || []).map(p => [p.id, p]));
  let added = 0, skipped = 0;
  for (const e of data.entries) {
    if (existing.has(e.id)) { skipped++; continue; }
    const p = photos.get(e.id);
    if (!p) { skipped++; continue; }
    await db.saveEntry(e, { full: new Blob([unb64(p.full)], { type: p.type }), thumb: new Blob([unb64(p.thumb)], { type: p.thumbType || p.type }) });
    added++;
  }
  if (data.meta && data.meta.customTags) await store.setMeta('customTags', [...new Set([...(store.meta.customTags || []), ...data.meta.customTags])]);
  await store.reload();
  toast(`${added}件を読み込みました${skipped ? `（${skipped}件は既にあるためスキップ）` : ''}`, 3600);
  rerender();
}

export async function renderSettings(root) {
  const standalone = document.documentElement.classList.contains('standalone');
  const userCount = store.entries.filter(e => !e.sample).length;
  const sampleCount = store.entries.filter(e => e.sample).length;
  let usage = '';
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage: u } = await navigator.storage.estimate();
      usage = `${(u / 1024 / 1024).toFixed(1)} MB`;
    }
  } catch { /* 取得できない環境もある */ }

  root.innerHTML = `
  ${topbar({ title: 'その他' })}
  <section class="pad settings">
    ${!standalone ? `
    <div class="card install">
      <h3>${icon('home', 18)} ホーム画面に追加する</h3>
      <ol>
        <li>Safari でこのページを開きます</li>
        <li>画面下の共有ボタン ${icon('share', 16)} を押します</li>
        <li>「ホーム画面に追加」を選びます</li>
      </ol>
      <p class="small-note">追加すると、アプリのように全画面で使えます。</p>
    </div>` : ''}

    <h3 class="group-title">今夜の空</h3>
    <div class="card form">
      <label class="srow"><span>地域</span>
        <select id="citySel">
          ${store.meta.geo ? '<option value="geo" selected>現在地（取得済み）</option>' : ''}
          ${CITIES.map(c => `<option value="${c.key}" ${!store.meta.geo && (store.meta.city || 'tokyo') === c.key ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </label>
      <button class="btn small" id="geoBtn">${icon('pin', 16)} 現在地を使う</button>
      <p class="small-note">日没・青い時間・月の目安と、天気の取得に使います。位置は端末の中にだけ保存されます。</p>
      <div class="srow"><span>天気</span>
        <div class="seg mini">
          <button data-wm="auto" class="${(store.meta.weatherMode || 'auto') === 'auto' ? 'on' : ''}">自動で取得</button>
          <button data-wm="manual" class="${store.meta.weatherMode === 'manual' ? 'on' : ''}">手動で設定</button>
        </div>
      </div>
      ${store.meta.weatherMode === 'manual' ? `
      <div class="chips" id="manualW">${Object.entries(WEATHER_LABEL).map(([k, l]) => `<button class="chip ${(store.meta.manualWeather || 'clear') === k ? 'on' : ''}" data-mw="${k}">${l}</button>`).join('')}</div>
      <p class="small-note">研究の実験やデモで、天気を決めて手紙を届けたいときに使います。手紙の文面は、ここで選んだ天気に合わせて書かれます。</p>`
      : `<p class="small-note">Open-Meteo（無料の気象データ）から、今の天気と数時間前の雨の有無を取得して、手紙の内容を選びます。</p>`}
    </div>

    <h3 class="group-title">使い方</h3>
    <div class="card list">
      <button class="row" id="howto">${icon('info', 18)}<span>夜景日記の使い方</span>${icon('right', 16)}</button>
      <a class="row" href="#/letters">${icon('letter', 18)}<span>手紙の一覧</span>${icon('right', 16)}</a>
    </div>

    <h3 class="group-title">データ</h3>
    <div class="card list">
      <div class="row static">${icon('book', 18)}<span>保存している記録</span><em>${userCount}件${usage ? ` ・ ${usage}` : ''}</em></div>
      <button class="row" id="exportBtn">${icon('download', 18)}<span>バックアップを書き出す</span>${icon('right', 16)}</button>
      <label class="row" for="importIn">${icon('upload', 18)}<span>バックアップから読み込む</span>${icon('right', 16)}</label>
      <input type="file" id="importIn" accept="application/json,.json" class="vh">
    </div>
    <p class="small-note">記録はこの端末のブラウザの中だけに保存されます。Safari の履歴とWebサイトデータを消去すると記録も消えるため、ときどきバックアップを書き出しておくと安心です。</p>

    <h3 class="group-title">サンプル記録</h3>
    <div class="card list">
      ${sampleCount ? `<button class="row danger-text" id="rmSamples">${icon('trash', 18)}<span>サンプル記録を削除する（${sampleCount}件）</span></button>`
        : `<button class="row" id="addSamples">${icon('sparkle', 18)}<span>サンプル記録を表示する</span></button>`}
    </div>
    <p class="small-note">サンプルは機能を試すための記録で、写真はアプリが描いたイラストです。削除しても、あなたが残した記録には影響しません。</p>

    <h3 class="group-title">アプリについて</h3>
    <div class="card about">
      <p class="about-name">夜景日記 <small>Nightscape Diary ・ v${APP_VERSION}</small></p>
      <p>いつもの帰り道で出会った、心に残る夜景と色を集める日記です。卒業研究「日常生活における身近な夜景への意識を促すサービスの提案」のプロトタイプとして制作しました。</p>
      <p class="small-note">通知・連続記録・ポイントなどはありません。綺麗だと思った夜にだけ、自分のペースで使ってください。</p>
    </div>

    <div class="card list">
      <button class="row danger-text" id="wipe">${icon('trash', 18)}<span>すべてのデータを削除する</span></button>
    </div>
  </section>`;

  $('#exportBtn', root).onclick = exportBackup;
  $('#importIn', root).onchange = e => { const f = e.target.files[0]; if (f) importBackup(f); };
  const rm = $('#rmSamples', root);
  if (rm) rm.onclick = async () => {
    if (!await confirmDialog({ title: 'サンプル記録を削除しますか？', body: 'あなたが残した記録は削除されません。サンプルはあとから再表示できます。', ok: '削除する', danger: true })) return;
    await store.removeSamples(); toast('サンプル記録を削除しました'); rerender();
  };
  const add = $('#addSamples', root);
  if (add) add.onclick = async () => { add.disabled = true; await store.addSamples(); toast('サンプル記録を表示しました'); rerender(); };
  $('#wipe', root).onclick = async () => {
    if (!await confirmDialog({ title: 'すべてのデータを削除しますか？', body: `あなたが残した記録${userCount}件と写真、採集した色がすべて削除されます。元に戻すことはできません。必要ならバックアップを書き出してください。`, ok: 'すべて削除', danger: true })) return;
    await db.clearAll();
    await store.setMeta('seeded', true);
    store.entries = []; store.meta = { seeded: true };
    toast('すべてのデータを削除しました'); location.replace('#/');
  };
  $('#howto', root).onclick = showHowTo;
  const refreshSky = async () => { store._sky = null; const r = { ...(store.meta.received || {}) }; delete r[new Date().toLocaleDateString('sv-SE')]; await store.setMeta('received', r); };
  $('#citySel', root).onchange = async e => {
    if (e.target.value !== 'geo') { await store.setMeta('geo', null); await store.setMeta('city', e.target.value); }
    await refreshSky(); toast('地域を変更しました'); rerender();
  };
  $('#geoBtn', root).onclick = () => {
    if (!navigator.geolocation) { toast('この環境では現在地を取得できません'); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      await store.setMeta('geo', { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2), name: '現在地' });
      await refreshSky(); toast('現在地を設定しました'); rerender();
    }, () => toast('現在地を取得できませんでした。地域を選んでください。', 3200), { timeout: 10000, maximumAge: 3600000 });
  };
  root.querySelectorAll('[data-wm]').forEach(b => b.onclick = async () => { await store.setMeta('weatherMode', b.dataset.wm); await refreshSky(); rerender(); });
  root.querySelectorAll('[data-mw]').forEach(b => b.onclick = async () => { await store.setMeta('manualWeather', b.dataset.mw); await refreshSky(); toast(`天気を「${b.textContent}」にしました`); rerender(); });
}

export function showHowTo() {
  sheet(`
    <h3 class="sheet-title">夜景日記の使い方</h3>
    <ol class="howto">
      <li><strong>手紙を読む</strong><span>「今夜」に一通、その日の天気・日没・月に合わせて、いつ・どこを・どう見るかを書いた手紙が届きます。読むだけで閉じても大丈夫です。</span></li>
      <li><strong>夜景を残す</strong><span>綺麗だと思った景色に出会ったら、下の「残す」から撮影するか、写真を選びます。</span></li>
      <li><strong>色を採集する</strong><span>写真の中の、綺麗だと思った場所に触れます。指を滑らせると拡大鏡が出ます。2本指で写真を拡大できます。1枚につき3色まで。</span></li>
      <li><strong>ふりかえる</strong><span>「日記」では日付やタグから、「色」では集めた色を星図や標本箱で眺められます。色に触れると、似た色に出会った別の夜が見つかることもあります。「色でめぐる夜」では、似た色をたどって過去の夜を順に見られます。</span></li>
    </ol>
    <div class="sheet-actions"><button class="btn primary wide" data-close>はじめる</button></div>`);
}

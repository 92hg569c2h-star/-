// 記録の詳細：写真（採集位置の印つき）、その夜のパレット、メモ、タグ、編集・削除
import { store } from '../store.js';
import { letterById } from '../letters.js';
import { esc, fmtDate, fmtTime, topbar, backBtn, confirmDialog, toast, go, $ } from '../ui.js';
import { icon } from '../icons.js';
import { inkFor } from '../colors.js';
import { openWallpaper } from '../wallpaper.js';

export async function renderEntry(root, [id]) {
  const e = store.entry(id);
  if (!e) { root.innerHTML = `${topbar({ left: backBtn('#/diary') })}<p class="pad">この記録は見つかりませんでした。削除された可能性があります。</p>`; return; }
  const letter = e.letterId ? letterById(e.letterId) : null;
  const all = store.allColors();
  const cols = (e.colors || []).map(c => all.find(a => a.entryId === e.id && a.id === c.id) || c);

  root.innerHTML = `
  ${topbar({ left: backBtn('#/diary'), cls: 'clear float', right: `
    <button class="icon-btn" id="editBtn" aria-label="編集">${icon('edit')}</button>
    <button class="icon-btn" id="delBtn" aria-label="削除">${icon('trash')}</button>` })}
  <div class="entry-photo-wrap">
  <figure class="entry-photo" style="aspect-ratio:${e.width}/${e.height};width:min(100%, calc(72dvh * ${(e.width / e.height).toFixed(4)}))">
    <img data-photo="${e.id}" data-kind="full" alt="${esc(e.title || '夜景の写真')}">
    <div class="pins" id="pins">
      ${cols.map((c, i) => `<button class="pin" style="left:${c.x * 100}%;top:${c.y * 100}%;--c:${c.hex}" data-go="#/color/${e.id}/${c.id}" aria-label="${esc(c.name)}"><span>${i + 1}</span></button>`).join('')}
    </div>
  </figure>
  </div>

  <section class="entry-body">
    ${e.sample ? `<p class="sample-note">${icon('info', 16)} 機能を試すためのサンプル記録です。写真はアプリが描いたイラストで、実在の人の記録ではありません。「その他」から削除できます。</p>` : ''}
    <p class="eb-date">${fmtDate(e.createdAt, true)} ${fmtTime(e.createdAt)}</p>
    <h1 class="eb-title">${esc(e.title || '無題の夜')}</h1>
    ${e.memo ? `<p class="eb-memo">${esc(e.memo).replace(/\n/g, '<br>')}</p>` : ''}
    ${(e.tags || []).length ? `<div class="chips">${e.tags.map(t => `<button class="chip" data-go="#/diary?tag=${encodeURIComponent(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}

    <h3 class="block-title mt">${icon('stripes', 16)} この夜のパレット</h3>
    ${cols.length ? `
    <div class="night-palette">
      ${cols.map(c => `
        <button class="np-col" style="background:${c.hex};color:${inkFor(c.rgb)}" data-go="#/color/${e.id}/${c.id}">
          <span class="np-no">${c.no ? 'No.' + String(c.no).padStart(3, '0') : ''}</span>
          <span class="np-name">${esc(c.nickname || c.name)}</span>
          <span class="np-hex">${c.hex}</span>
        </button>`).join('')}
    </div>
    <p class="small-note">色に触れると、その色の詳細と、似た色に出会った別の夜を見ることができます。</p>
    <button class="row-link" id="wallBtn">${icon('image', 18)}<span>この夜の色で壁紙をつくる</span>${icon('right', 16)}</button>`
    : `<p class="small-note">この夜は、色を採集せずに残しました。<button class="link-btn" id="addColors">あとから色を採集する</button></p>`}

    ${letter ? `<a class="row-link" href="#/letter/${letter.id}">${icon('letter', 18)}<span>手紙「${esc(store.letterTitle(letter.id) || letter.theme + 'の手紙')}」を読んで残した夜</span>${icon('right', 16)}</a>` : ''}
  </section>`;

  $('#editBtn', root).onclick = () => go(`#/edit/${e.id}`);
  const wb = $('#wallBtn', root); if (wb) wb.onclick = () => openWallpaper(e);
  const add = $('#addColors', root); if (add) add.onclick = () => go(`#/edit/${e.id}`);
  $('#delBtn', root).onclick = async () => {
    const ok = await confirmDialog({
      title: 'この記録を削除しますか？',
      body: `「${esc(e.title || '無題の夜')}」の写真と、採集した${cols.length ? cols.length + '色' : '色'}も一緒に削除されます。この操作は取り消せません。`,
      ok: '削除する', danger: true,
    });
    if (!ok) return;
    await store.remove(e.id);
    toast('記録を削除しました');
    location.replace('#/diary');
  };
}

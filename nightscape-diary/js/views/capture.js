// 夜景を残す：写真の撮影・選択 → 確認 → 色の採集（最大3色）→ 日記を書く → 保存
import { store } from '../store.js';
import { letterById } from '../letters.js';
import { fileToImage, preparePhoto, blobToCanvas, sampleColor, readExifDate } from '../image.js';
import { rgbToHex, nearestName, inkFor } from '../colors.js';
import { esc, $, $$, toast, confirmDialog, sheet, fmtDate, fmtTime, relDay, toLocalInput, back } from '../ui.js';
import { icon } from '../icons.js';

const MAX_COLORS = 3;
let st = null;

function uid(prefix = '') {
  return prefix + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
}

export async function openCapture({ editId, letterId }) {
  document.querySelector('.capture')?.remove();
  stopCamera();
  const el = document.createElement('div');
  el.className = 'capture';
  document.body.appendChild(el);
  st = {
    el, mode: editId ? 'edit' : 'new', editEntry: null, letterId,
    photo: null, imageData: null, photoChanged: false,
    colors: [], probe: null, sampleMode: 'avg',
    title: '', memo: '', tags: new Set(), date: new Date(), dateSource: 'now',
    dirty: false,
  };
  if (letterId) { const l = letterById(letterId); if (l && l.tag) st.tags.add(l.tag); }

  if (editId) {
    const e = store.entry(editId);
    if (!e) { location.replace('#/diary'); return; }
    st.editEntry = e;
    st.letterId = e.letterId;
    st.title = e.title || ''; st.memo = e.memo || '';
    st.tags = new Set(e.tags || []);
    st.date = new Date(e.createdAt); st.dateSource = 'saved';
    st.colors = (e.colors || []).map(c => ({ ...c }));
    el.innerHTML = '<div class="cap-loading">写真を読み込んでいます…</div>';
    const p = await store.photoUrl(e.id, 'full');
    const blob = await fetch(p).then(r => r.blob());
    const canvas = await blobToCanvas(blob);
    st.photo = { canvas, width: canvas.width, height: canvas.height, url: p };
    st.imageData = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
    showPick();
  } else {
    showSource();
  }
}

function closeCapture(force = false) {
  const leave = () => { stopCamera(); st = null; back('#/'); };
  if (force || !st || !st.dirty) return leave();
  confirmDialog({ title: '記録をやめますか？', body: '撮影した写真や採集した色は保存されません。', ok: 'やめる', cancel: '続ける', danger: true })
    .then(ok => { if (ok) leave(); });
}

/* ---------- 1. 写真の入手 ---------- */
function showSource() {
  const l = st.letterId ? letterById(st.letterId) : null;
  st.el.innerHTML = `
  <div class="cap-screen source">
    <header class="cap-top">
      <button class="icon-btn" id="capClose" aria-label="閉じる">${icon('close')}</button>
      <h2>${st.mode === 'edit' ? '写真を変える' : '夜景を残す'}</h2><span></span>
    </header>
    <div class="src-body">
      ${l ? `<p class="src-letter">${icon('letter', 16)} 手紙「${esc(store.letterTitle(l.id) || l.theme + 'の手紙')}」</p>` : ''}
      <p class="src-lead">綺麗だと思った夜を、<br>写真で残しましょう。</p>
      <div class="src-opts">
        <button class="src-opt" id="srcLive">
          <span class="so-ic">${icon('aperture', 26)}</span>
          <span class="so-t"><strong>アプリ内カメラで撮る</strong><small>撮ってすぐに色を採集できます</small></span>
        </button>
        <label class="src-opt" for="camIn">
          <span class="so-ic">${icon('camera', 26)}</span>
          <span class="so-t"><strong>iPhoneのカメラで撮る</strong><small>ナイトモードが使えるので、暗い景色もきれいに撮れます</small></span>
        </label>
        <label class="src-opt" for="libIn">
          <span class="so-ic">${icon('image', 26)}</span>
          <span class="so-t"><strong>写真から選ぶ</strong><small>帰ってから、ゆっくり記録しても大丈夫です</small></span>
        </label>
      </div>
      <input type="file" accept="image/*" capture="environment" id="camIn" class="vh">
      <input type="file" accept="image/*" id="libIn" class="vh">
      <p class="small-note center">撮影した写真は日記の中に保存されます。<br>iPhoneの写真ライブラリには自動で保存されません。</p>
    </div>
  </div>`;
  $('#capClose', st.el).onclick = () => (st.mode === 'edit' ? showPick() : closeCapture());
  $('#srcLive', st.el).onclick = showCamera;
  const onFile = async (ev, source) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    st.el.querySelector('.src-body').classList.add('busy');
    try {
      const img = await fileToImage(f);
      const exif = await readExifDate(f);
      await usePhoto(img, source === 'lib' ? (exif || null) : null);
    } catch (err) {
      console.error(err);
      toast('この写真は読み込めませんでした。別の写真を選んでください。');
      st.el.querySelector('.src-body')?.classList.remove('busy');
    }
  };
  $('#camIn', st.el).onchange = e => onFile(e, 'cam');
  $('#libIn', st.el).onchange = e => onFile(e, 'lib');
}

let stream = null;
function stopCamera() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }

async function showCamera() {
  st.el.innerHTML = `
  <div class="cap-screen camera">
    <video id="video" playsinline autoplay muted></video>
    <header class="cap-top over">
      <button class="icon-btn" id="camBack" aria-label="戻る">${icon('back')}</button>
      <h2>撮影</h2><span></span>
    </header>
    <div class="cam-msg" id="camMsg">カメラを起動しています…</div>
    <div class="cam-bar">
      <label for="camIn2" class="cam-alt">${icon('camera', 20)}<span>iPhoneのカメラ</span></label>
      <button class="shutter" id="shutter" aria-label="撮影する" disabled><span></span></button>
      <span class="cam-alt ghost"></span>
    </div>
    <input type="file" accept="image/*" capture="environment" id="camIn2" class="vh">
  </div>`;
  $('#camBack', st.el).onclick = () => { stopCamera(); showSource(); };
  $('#camIn2', st.el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    stopCamera();
    await usePhoto(await fileToImage(f), null);
  };
  const video = $('#video', st.el);
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(() => {});
    $('#camMsg', st.el).remove();
    const sh = $('#shutter', st.el);
    sh.disabled = false;
    sh.onclick = async () => {
      if (!video.videoWidth) return;
      sh.disabled = true;
      st.el.querySelector('.camera').classList.add('flash');
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      stopCamera();
      await usePhoto(c, null);
    };
  } catch (err) {
    $('#camMsg', st.el).innerHTML = `
      <p>このブラウザではアプリ内カメラを使えませんでした。</p>
      <p class="small-note">カメラの使用が許可されていない、またはHTTPSで開かれていない可能性があります。下の「iPhoneのカメラ」から撮影できます。</p>`;
  }
}

async function usePhoto(source, exifDate) {
  st.el.innerHTML = '<div class="cap-loading">写真を整えています…</div>';
  const p = await preparePhoto(source);
  if (st.photo && st.photo.url && st.photoChanged) URL.revokeObjectURL(st.photo.url);
  st.photo = { ...p, url: URL.createObjectURL(p.fullBlob) };
  st.imageData = p.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, p.width, p.height);
  st.photoChanged = true;
  st.colors = [];
  st.probe = null;
  st.dirty = true;
  if (st.mode === 'new') {
    st.date = exifDate || new Date();
    st.dateSource = exifDate ? 'exif' : 'now';
  }
  showConfirm();
}

/* ---------- 2. 写真の確認 ---------- */
function showConfirm() {
  st.el.innerHTML = `
  <div class="cap-screen confirm">
    <header class="cap-top">
      <button class="icon-btn" id="cfBack" aria-label="選び直す">${icon('back')}</button>
      <h2>この写真でいいですか？</h2><span></span>
    </header>
    <div class="cf-photo"><img src="${st.photo.url}" alt="選んだ写真"></div>
    ${st.dateSource === 'exif' ? `<p class="small-note center">撮影日時 ${fmtDate(st.date, true)} ${fmtTime(st.date)}</p>` : ''}
    <div class="cap-actions">
      <button class="btn ghost" id="cfRetry">選び直す</button>
      <button class="btn primary" id="cfOk">この写真を使う</button>
    </div>
  </div>`;
  const retry = () => showSource();
  $('#cfBack', st.el).onclick = retry;
  $('#cfRetry', st.el).onclick = retry;
  $('#cfOk', st.el).onclick = showPick;
}

/* ---------- 3. 色の採集 ---------- */
function showPick() {
  const W = st.photo.width, H = st.photo.height;
  st.el.innerHTML = `
  <div class="cap-screen pick">
    <header class="cap-top">
      <button class="icon-btn" id="pkBack" aria-label="戻る">${icon(st.mode === 'edit' ? 'close' : 'back')}</button>
      <h2>色を採集する</h2>
      <button class="text-btn" id="pkNext">次へ</button>
    </header>
    <div class="stage" id="stage">
      <div class="stage-inner" id="inner">
        <canvas id="disp" width="${W}" height="${H}"></canvas>
        <div class="marks" id="marks"></div>
      </div>
      <canvas class="loupe" id="loupe" width="264" height="264"></canvas>
      <div class="zoom-ctl">
        <button id="zIn" aria-label="拡大">${icon('zoomIn', 20)}</button>
        <button id="zOut" aria-label="縮小">${icon('zoomOut', 20)}</button>
        <button id="zFit" aria-label="全体を表示">${icon('fit', 20)}</button>
      </div>
      <div class="pick-hint" id="hint">${st.colors.length ? '別の場所に触れると、色を選び直せます' : '綺麗だと思った場所に、触れてください'}<small>指を滑らせると拡大鏡 ・ 2本指で写真を拡大</small></div>
    </div>
    <div class="pick-panel">
      <div class="probe" id="probe">
        <span class="probe-sw empty" id="probeSw"></span>
        <div class="probe-txt">
          <strong id="probeName">まだ選んでいません</strong>
          <small id="probeCode">写真の中の色に触れてください</small>
        </div>
        <button class="mode-btn" id="modeBtn" title="色の取り方">${st.sampleMode === 'avg' ? '周囲3×3' : '1画素'}</button>
      </div>
      <button class="btn primary wide" id="collectBtn" disabled>${icon('drop', 18)} この色を採集する</button>
      <div class="slots-row">
        <div class="slots" id="slots"></div>
        <p class="slots-note" id="slotsNote"></p>
      </div>
      ${st.mode === 'edit' ? `<button class="link-btn center-block" id="changePhoto">写真を変える</button>` : ''}
    </div>
  </div>`;

  const stage = $('#stage', st.el), inner = $('#inner', st.el), disp = $('#disp', st.el);
  disp.getContext('2d').drawImage(st.photo.canvas, 0, 0);
  const loupe = $('#loupe', st.el), lctx = loupe.getContext('2d');
  const hint = $('#hint', st.el);

  // 表示の変形（拡大率 s は「画面に収まる大きさ」を 1 とする）
  const view = { fit: 1, s: 1, tx: 0, ty: 0, sw: 0, sh: 0 };
  const layout = () => {
    const r = stage.getBoundingClientRect();
    view.sw = r.width; view.sh = r.height;
    view.fit = Math.min(r.width / W, r.height / H);
    inner.style.width = W * view.fit + 'px';
    inner.style.height = H * view.fit + 'px';
  };
  const clamp = () => {
    const w = W * view.fit * view.s, h = H * view.fit * view.s;
    view.tx = w <= view.sw ? (view.sw - w) / 2 : Math.min(0, Math.max(view.sw - w, view.tx));
    view.ty = h <= view.sh ? (view.sh - h) / 2 : Math.min(0, Math.max(view.sh - h, view.ty));
  };
  const apply = () => {
    clamp();
    inner.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
    inner.style.setProperty('--inv', 1 / view.s);
  };
  const zoomAt = (factor, cx, cy) => {
    const ns = Math.max(1, Math.min(10, view.s * factor));
    const px = (cx - view.tx) / view.s, py = (cy - view.ty) / view.s;
    view.s = ns; view.tx = cx - px * ns; view.ty = cy - py * ns;
    apply();
  };
  layout(); apply();
  const ro = new ResizeObserver(() => { layout(); apply(); });
  ro.observe(stage);

  // 画面座標 → 写真の画素座標（表示倍率・余白に関係なく正しく対応させる）
  const toImage = (clientX, clientY) => {
    const r = disp.getBoundingClientRect();
    const fx = Math.max(0, Math.min(0.99999, (clientX - r.left) / r.width));
    const fy = Math.max(0, Math.min(0.99999, (clientY - r.top) / r.height));
    return { fx, fy, px: fx * W, py: fy * H };
  };

  const drawMarks = () => {
    $('#marks', st.el).innerHTML =
      st.colors.map((c, i) => `<span class="mark done" style="left:${c.x * 100}%;top:${c.y * 100}%;--c:${c.hex}"><b>${i + 1}</b></span>`).join('') +
      (st.probe ? `<span class="mark probe" style="left:${st.probe.x * 100}%;top:${st.probe.y * 100}%;--c:${st.probe.hex}"></span>` : '');
  };

  const updatePanel = () => {
    const p = st.probe;
    const sw = $('#probeSw', st.el);
    if (p) {
      sw.classList.remove('empty'); sw.style.background = p.hex;
      $('#probeName', st.el).textContent = p.name;
      $('#probeCode', st.el).textContent = `${p.hex} ・ RGB ${p.rgb.join(', ')}`;
    }
    const full = st.colors.length >= MAX_COLORS;
    const btn = $('#collectBtn', st.el);
    btn.disabled = !p || full;
    btn.innerHTML = full ? '3色を採集しました' : `${icon('drop', 18)} この色を採集する`;
    $('#slots', st.el).innerHTML = Array.from({ length: MAX_COLORS }, (_, i) => {
      const c = st.colors[i];
      return c ? `<button class="slot filled" data-slot="${i}" style="--c:${c.hex}" aria-label="${i + 1}色目 ${esc(c.name)}"><span></span></button>`
        : `<span class="slot" aria-hidden="true"><span>${i + 1}</span></span>`;
    }).join('');
    $('#slotsNote', st.el).textContent = full ? '取り消すと、選び直せます'
      : st.colors.length ? `あと${MAX_COLORS - st.colors.length}色まで。採集した色に触れると取り消せます`
      : '1枚につき3色まで。色を採集しなくても保存できます';
    $('#pkNext', st.el).textContent = st.colors.length ? '次へ' : (st.mode === 'edit' ? '次へ' : 'スキップ');
    drawMarks();
  };

  const setProbe = (fx, fy) => {
    const rgb = sampleColor(st.imageData, fx * W, fy * H, st.sampleMode);
    st.probe = { x: fx, y: fy, rgb, hex: rgbToHex(rgb), name: nearestName(rgb) };
    hint.classList.add('gone');
    updatePanel();
  };

  const drawLoupe = (clientX, clientY) => {
    const { px, py } = toImage(clientX, clientY);
    const N = 15, Z = loupe.width / N;
    lctx.imageSmoothingEnabled = false;
    lctx.fillStyle = '#000'; lctx.fillRect(0, 0, loupe.width, loupe.height);
    lctx.drawImage(st.photo.canvas, Math.floor(px) - 7, Math.floor(py) - 7, N, N, 0, 0, loupe.width, loupe.height);
    const k = st.sampleMode === 'avg' ? 3 : 1, o = (N - k) / 2 * Z;
    lctx.lineWidth = 4; lctx.strokeStyle = 'rgba(0,0,0,.6)'; lctx.strokeRect(o, o, k * Z, k * Z);
    lctx.lineWidth = 2; lctx.strokeStyle = '#fff'; lctx.strokeRect(o, o, k * Z, k * Z);
    const sr = stage.getBoundingClientRect();
    const lx = clientX - sr.left, ly = clientY - sr.top;
    const size = 132;
    let top = ly - size - 46; if (top < 6) top = ly + 46;
    let left = Math.max(6, Math.min(sr.width - size - 6, lx - size / 2));
    loupe.style.transform = `translate(${left}px, ${top}px)`;
    loupe.style.setProperty('--c', st.probe ? st.probe.hex : '#fff');
  };

  // ポインター操作：1本指＝色を選ぶ（拡大鏡）、2本指＝拡大・移動
  const pts = new Map();
  let mode = null, pinch = null, saved = null;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.zoom-ctl')) return;
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* 環境によっては不可 */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      mode = 'probe'; saved = st.probe;
      const { fx, fy } = toImage(e.clientX, e.clientY);
      setProbe(fx, fy);
      loupe.classList.add('show'); drawLoupe(e.clientX, e.clientY);
    } else if (pts.size === 2) {
      mode = 'pinch'; loupe.classList.remove('show');
      st.probe = saved; updatePanel();
      const [a, b] = [...pts.values()];
      const sr = stage.getBoundingClientRect();
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), s0: view.s, tx0: view.tx, ty0: view.ty,
        mx0: (a.x + b.x) / 2 - sr.left, my0: (a.y + b.y) / 2 - sr.top };
    }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'probe' && pts.size === 1) {
      const { fx, fy } = toImage(e.clientX, e.clientY);
      setProbe(fx, fy); drawLoupe(e.clientX, e.clientY);
    } else if (mode === 'pinch' && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const sr = stage.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2 - sr.left, my = (a.y + b.y) / 2 - sr.top;
      const ns = Math.max(1, Math.min(10, pinch.s0 * d / pinch.d0));
      const cx = (pinch.mx0 - pinch.tx0) / pinch.s0, cy = (pinch.my0 - pinch.ty0) / pinch.s0;
      view.s = ns; view.tx = mx - cx * ns; view.ty = my - cy * ns;
      apply();
    }
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (pts.size === 0) { mode = null; loupe.classList.remove('show'); }
    else if (mode === 'pinch' && pts.size === 1) mode = 'idle'; // 片方の指が残っても色は選ばない
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const sr = stage.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - sr.left, e.clientY - sr.top);
  }, { passive: false });
  $('#zIn', st.el).onclick = () => zoomAt(1.6, view.sw / 2, view.sh / 2);
  $('#zOut', st.el).onclick = () => zoomAt(1 / 1.6, view.sw / 2, view.sh / 2);
  $('#zFit', st.el).onclick = () => { view.s = 1; apply(); };

  $('#modeBtn', st.el).onclick = () => {
    st.sampleMode = st.sampleMode === 'avg' ? 'px' : 'avg';
    $('#modeBtn', st.el).textContent = st.sampleMode === 'avg' ? '周囲3×3' : '1画素';
    toast(st.sampleMode === 'avg' ? '触れた点のまわり3×3画素の平均を取ります（夜の写真のざらつきを抑えます）' : '触れた1画素の色をそのまま取ります', 3200);
    if (st.probe) setProbe(st.probe.x, st.probe.y);
  };

  $('#collectBtn', st.el).onclick = () => {
    if (!st.probe || st.colors.length >= MAX_COLORS) return;
    const p = st.probe;
    const c = { id: uid('c-'), hex: p.hex, rgb: p.rgb, name: p.name, nickname: '', x: p.x, y: p.y, mode: st.sampleMode };
    st.colors.push(c);
    st.probe = null; st.dirty = true;
    flyToSlot(c, st.colors.length - 1);
    $('#probeSw', st.el).classList.add('empty'); $('#probeSw', st.el).style.background = '';
    $('#probeName', st.el).textContent = st.colors.length < MAX_COLORS ? 'ほかにも綺麗な色はありますか？' : '3色そろいました';
    $('#probeCode', st.el).textContent = st.colors.length < MAX_COLORS ? '続けて触れると、もう一色採集できます' : '「次へ」で日記を書きましょう';
    updatePanel();
    // 似た色との再会（採集したその場で、過去の夜とつながる）
    const r = store.reunionFor(c.rgb, st.editEntry && st.editEntry.id);
    if (r) {
      setTimeout(() => toast(`<span class="tw-pair"><i style="background:${c.hex}"></i><i style="background:${r.hex}"></i></span><span>${relDay(r.entry.createdAt)}の「${esc(r.entry.title || '無題の夜')}」でも、<br>似た色を採集していました。</span>`, 4200), 650);
    }
  };

  $('#slots', st.el).addEventListener('click', e => {
    const b = e.target.closest('[data-slot]'); if (!b) return;
    const i = +b.dataset.slot, c = st.colors[i];
    sheet(`
      <div class="slot-sheet">
        <span class="ss-sw" style="background:${c.hex}"></span>
        <div><strong>${esc(c.nickname || c.name)}</strong><small>${c.hex} ・ RGB ${c.rgb.join(', ')}</small></div>
      </div>
      <label class="field"><span>自分だけの呼び名（任意）</span><input id="nick" maxlength="24" placeholder="例：駅前の信号の青" value="${esc(c.nickname || '')}"></label>
      <div class="sheet-actions">
        <button class="btn danger-ghost" id="rmColor">${icon('trash', 16)} 取り消す</button>
        <button class="btn primary" id="okColor">決定</button>
      </div>`, {
      onMount(el, close) {
        $('#rmColor', el).onclick = () => { st.colors.splice(i, 1); close(); updatePanel(); };
        $('#okColor', el).onclick = () => { c.nickname = $('#nick', el).value.trim(); close(); updatePanel(); };
      },
    });
  });

  $('#pkBack', st.el).onclick = () => {
    ro.disconnect();
    if (st.mode === 'edit') closeCapture(); else showConfirm();
  };
  $('#pkNext', st.el).onclick = () => { ro.disconnect(); showWrite(); };
  const cp = $('#changePhoto', st.el);
  if (cp) cp.onclick = async () => {
    if (st.colors.length && !await confirmDialog({ title: '写真を変えますか？', body: '採集した色は、新しい写真で選び直すことになります。', ok: '写真を変える' })) return;
    ro.disconnect(); showSource();
  };

  updatePanel();
}

function flyToSlot(c, index) {
  const from = $('#probeSw', st.el).getBoundingClientRect();
  requestAnimationFrame(() => {
    const slot = $(`[data-slot="${index}"]`, st.el);
    if (!slot) return;
    const to = slot.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'fly-dot';
    dot.style.background = c.hex;
    dot.style.left = from.left + 'px'; dot.style.top = from.top + 'px';
    dot.style.width = from.width + 'px'; dot.style.height = from.height + 'px';
    document.body.appendChild(dot);
    slot.style.visibility = 'hidden';
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const anim = dot.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(.9)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width})`, opacity: 1 },
    ], { duration: 560, easing: 'cubic-bezier(.4,.0,.2,1)' });
    anim.onfinish = () => { dot.remove(); slot.style.visibility = ''; slot.classList.add('pop'); };
  });
}

/* ---------- 4. 日記を書く ---------- */
function showWrite() {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const l = st.letterId ? letterById(st.letterId) : null;
  const allTags = store.allTagNames();
  st.tags.forEach(t => { if (!allTags.includes(t)) allTags.push(t); });
  st.el.innerHTML = `
  <div class="cap-screen write">
    <header class="cap-top">
      <button class="icon-btn" id="wrBack" aria-label="色の採集に戻る">${icon('back')}</button>
      <h2>日記を書く</h2><span></span>
    </header>
    <div class="write-body">
      <div class="wr-preview">
        <img src="${st.photo.url}" alt="">
        <div class="wr-pal">${st.colors.length ? st.colors.map(c => `<span><i style="background:${c.hex}"></i>${esc(c.nickname || c.name)}</span>`).join('') : '<em>色は採集していません</em>'}</div>
      </div>
      ${l ? `<p class="src-letter">${icon('letter', 16)} 手紙「${esc(store.letterTitle(l.id) || l.theme + 'の手紙')}」から残す夜</p>` : ''}
      <label class="field"><span>タイトル<small>任意</small></span>
        <input id="fTitle" maxlength="40" placeholder="例：いつもの帰り道" value="${esc(st.title)}"></label>
      <label class="field"><span>一言<small>任意</small></span>
        <textarea id="fMemo" rows="3" maxlength="400" placeholder="どんな景色でしたか？">${esc(st.memo)}</textarea></label>
      <div class="field"><span>タグ<small>いくつでも</small></span>
        <div class="chips wrap" id="tagBox">
          ${allTags.map(t => `<button type="button" class="chip ${st.tags.has(t) ? 'on' : ''}" data-t="${esc(t)}">#${esc(t)}</button>`).join('')}
        </div>
        <div class="tag-add"><input id="newTag" maxlength="16" placeholder="新しいタグをつくる" enterkeyhint="done"><button type="button" class="btn small" id="addTag">${icon('plus', 16)} 追加</button></div>
      </div>
      <label class="field"><span>日時</span>
        <input type="datetime-local" id="fDate" value="${toLocalInput(st.date)}">
        ${st.dateSource === 'exif' ? '<small class="hint">写真の撮影日時を入れています</small>' : ''}
      </label>
    </div>
    <div class="write-foot"><button class="btn primary wide" id="saveBtn">${icon('check', 18)} ${st.mode === 'edit' ? '変更を保存する' : 'この夜を残す'}</button></div>
  </div>`;

  const sync = () => {
    st.title = $('#fTitle', st.el).value.trim();
    st.memo = $('#fMemo', st.el).value.trim();
    const v = $('#fDate', st.el).value;
    if (v) { const d = new Date(v); if (!isNaN(d)) st.date = d; }
  };
  $('#wrBack', st.el).onclick = () => { sync(); showPick(); };
  $('#tagBox', st.el).addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const t = b.dataset.t;
    st.tags.has(t) ? st.tags.delete(t) : st.tags.add(t);
    b.classList.toggle('on'); st.dirty = true;
  });
  const addTag = async () => {
    const inp = $('#newTag', st.el);
    const t = inp.value.trim().replace(/^#/, '').replace(/\s+/g, '');
    if (!t) return;
    st.tags.add(t);
    const custom = new Set(store.meta.customTags || []); custom.add(t);
    await store.setMeta('customTags', [...custom]);
    if (!$(`[data-t="${CSS.escape(t)}"]`, st.el)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip on'; b.dataset.t = t; b.textContent = '#' + t;
      $('#tagBox', st.el).appendChild(b);
    } else $(`[data-t="${CSS.escape(t)}"]`, st.el).classList.add('on');
    inp.value = '';
  };
  $('#addTag', st.el).onclick = addTag;
  $('#newTag', st.el).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } });
  $('#saveBtn', st.el).onclick = async () => {
    sync();
    const btn = $('#saveBtn', st.el); btn.disabled = true; btn.textContent = '保存しています…';
    try { await save(); } catch (err) {
      console.error(err);
      btn.disabled = false; btn.textContent = 'もう一度保存する';
      toast('保存できませんでした。端末の空き容量を確認してください。', 4000);
    }
  };
}

async function save() {
  const base = st.editEntry || { id: uid('n-'), sample: false };
  const entry = {
    ...base,
    createdAt: st.date.toISOString(),
    updatedAt: new Date().toISOString(),
    title: st.title, memo: st.memo, tags: [...st.tags],
    colors: st.colors.map(({ id, hex, rgb, name, nickname, x, y, mode }) => ({ id, hex, rgb, name, nickname: nickname || '', x, y, mode })),
    width: st.photo.width, height: st.photo.height,
    letterId: st.letterId || null,
  };
  const photo = st.photoChanged ? { full: st.photo.fullBlob, thumb: st.photo.thumbBlob } : null;
  await store.save(entry, photo);
  st.dirty = false;
  if (st.mode === 'edit') {
    toast('変更を保存しました');
    st = null;
    location.replace(`#/entry/${entry.id}`);
    return;
  }
  showDone(entry);
}

/* ---------- 5. 保存できました ---------- */
function showDone(entry) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const cols = entry.colors;
  const msg = cols.length
    ? `${fmtDate(entry.createdAt)}の夜から、<br>${cols.length}つの色を持ち帰りました。`
    : `${fmtDate(entry.createdAt)}の夜を、<br>日記に残しました。`;
  st.el.innerHTML = `
  <div class="cap-screen done">
    <div class="done-body">
      <div class="done-photo"><img src="${st.photo.url}" alt=""></div>
      ${cols.length ? `<div class="done-pal">${cols.map((c, i) => `<div class="dp" style="background:${c.hex};color:${inkFor(c.rgb)};animation-delay:${0.25 + i * 0.18}s"><span>${esc(c.nickname || c.name)}</span><small>${c.hex}</small></div>`).join('')}</div>` : ''}
      <p class="done-msg">${msg}</p>
    </div>
    <div class="cap-actions col">
      <button class="btn primary wide" id="toEntry">日記を見る</button>
      <button class="btn ghost wide" id="toHome">閉じる</button>
    </div>
  </div>`;
  $('#toEntry', st.el).onclick = () => { st = null; location.replace(`#/entry/${entry.id}`); };
  $('#toHome', st.el).onclick = () => { st = null; location.replace('#/'); };
}

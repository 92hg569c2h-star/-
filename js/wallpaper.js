// その夜のパレットから、スマートフォンの壁紙をつくる（自分のために持ち帰る）
// 文字は「あり／なし」を選べ、ありのときはタイトル・日付・色名・カラーコードを個別に切り替えられる。
// プレビューと保存される画像は、同じ canvas から作るので必ず一致する。
import { sheet, esc, fmtDots, $, $$, toast } from './ui.js';
import { icon } from './icons.js';
import { inkFor, rgbToOklab } from './colors.js';
import { store } from './store.js';

const W = 1179, H = 2556; // iPhone 15 / 16 の画面（縦長）
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const SANS = '-apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif';
const DEFAULT = { style: 'gradient', text: true, title: true, date: true, name: true, code: false };

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const inkOn = rgb => inkFor(rgb) === '#FFFFFF' ? 'rgba(255,255,255,.82)' : 'rgba(16,20,42,.78)';
const label = c => c.nickname || c.name;

function drawGradient(ctx, entry, o) {
  const cols = entry.colors;
  const sorted = [...cols].sort((a, b) => rgbToOklab(a.rgb)[0] - rgbToOklab(b.rgb)[0]); // 暗い色を上に
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (sorted.length === 1) { g.addColorStop(0, '#0B1026'); g.addColorStop(1, sorted[0].hex); }
  else sorted.forEach((c, i) => g.addColorStop(0.08 + i / (sorted.length - 1) * 0.84, c.hex));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = rnd(entry.id.length * 97 + cols.length);
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.15 + r() * 0.45; ctx.fillStyle = '#fff';
    const s = r() < 0.9 ? 2 : 4;
    ctx.fillRect(r() * W, r() * H * 0.45, s, s);
  }
  ctx.globalAlpha = 1;
  if (!o.text) return;
  // 文字は下の方に（ロック画面の時計と重ならないように）
  const lines = [];
  if (o.title && entry.title) lines.push([`500 46px ${SERIF}`, entry.title]);
  if (o.date) lines.push([`400 32px ${SANS}`, fmtDots(entry.createdAt)]);
  if (o.name || o.code) {
    const parts = cols.map(c => [o.name ? label(c) : '', o.code ? c.hex : ''].filter(Boolean).join(' '));
    lines.push([`400 30px ${SANS}`, parts.join('  ・  ')]);
  }
  ctx.fillStyle = inkOn(sorted[sorted.length - 1].rgb);
  ctx.textAlign = 'center';
  let y = H - 170 - (lines.length - 1) * 58;
  lines.forEach(([font, t]) => { ctx.font = font; ctx.fillText(t, W / 2, y, W - 160); y += 58; });
}

function drawStripes(ctx, entry, o) {
  const cols = entry.colors, h = H / cols.length;
  cols.forEach((c, i) => {
    ctx.fillStyle = c.hex; ctx.fillRect(0, i * h, W, h + 1);
    if (!o.text) return;
    ctx.fillStyle = inkOn(c.rgb); ctx.textAlign = 'left';
    const base = (i + 1) * h - (i === cols.length - 1 ? 260 : 110);
    if (o.name) { ctx.font = `600 58px ${SERIF}`; ctx.fillText(label(c), 90, base - (o.code ? 56 : 0), W - 180); }
    if (o.code) { ctx.font = `400 34px ${SANS}`; ctx.fillText(c.hex, 90, base); }
  });
  if (!o.text) return;
  const last = cols[cols.length - 1];
  const foot = [o.title && entry.title ? entry.title : '', o.date ? fmtDots(entry.createdAt) : ''].filter(Boolean).join('   ');
  if (foot) { ctx.fillStyle = inkOn(last.rgb); ctx.font = `400 32px ${SANS}`; ctx.textAlign = 'left'; ctx.fillText(foot, 90, H - 150, W - 180); }
}

export function renderWallpaper(entry, o) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  (o.style === 'stripes' ? drawStripes : drawGradient)(c.getContext('2d'), entry, o);
  return c;
}

export function openWallpaper(entry) {
  const o = { ...DEFAULT, ...(store.meta.wallpaperOpts || {}) };
  let canvas = renderWallpaper(entry, o);
  const chk = (k, t) => `<label class="wp-chk"><input type="checkbox" data-k="${k}" ${o[k] ? 'checked' : ''}><span>${t}</span></label>`;
  sheet(`
    <h3 class="sheet-title">この夜の色で壁紙をつくる</h3>
    <div class="seg mini wp-seg">
      <button data-style="gradient" class="${o.style === 'gradient' ? 'on' : ''}">グラデーション</button>
      <button data-style="stripes" class="${o.style === 'stripes' ? 'on' : ''}">色見本</button>
    </div>
    <div class="seg mini wp-seg">
      <button data-text="1" class="${o.text ? 'on' : ''}">文字あり</button>
      <button data-text="0" class="${!o.text ? 'on' : ''}">文字なし</button>
    </div>
    <div class="wp-opts" id="wpOpts" ${o.text ? '' : 'hidden'}>
      ${chk('title', 'タイトル')}${chk('date', '日付')}${chk('name', '色名')}${chk('code', 'カラーコード')}
    </div>
    <div class="wp-preview"><img id="wpImg" alt="壁紙のプレビュー"></div>
    <p class="small-note center">保存される画像は、このプレビューと同じです（${W}×${H}）。<br>画像を長押しして「"写真"に保存」でも保存できます。</p>
    <div class="sheet-actions"><button class="btn ghost" data-close>閉じる</button><button class="btn primary" id="wpSave">${icon('download', 18)} 保存</button></div>`, {
    onMount(el) {
      const img = $('#wpImg', el);
      const redraw = () => {
        canvas = renderWallpaper(entry, o);
        img.src = canvas.toDataURL('image/png');
        store.setMeta('wallpaperOpts', { ...o });
      };
      redraw();
      $$('[data-style]', el).forEach(b => b.onclick = () => {
        o.style = b.dataset.style;
        $$('[data-style]', el).forEach(x => x.classList.toggle('on', x === b)); redraw();
      });
      $$('[data-text]', el).forEach(b => b.onclick = () => {
        o.text = b.dataset.text === '1';
        $$('[data-text]', el).forEach(x => x.classList.toggle('on', x === b));
        $('#wpOpts', el).hidden = !o.text; redraw();
      });
      $$('[data-k]', el).forEach(c => c.onchange = () => { o[c.dataset.k] = c.checked; redraw(); });
      $('#wpSave', el).onclick = () => canvas.toBlob(async blob => {
        if (!blob) { toast('画像を作れませんでした。もう一度お試しください。'); return; }
        const file = new File([blob], `nightscape-${fmtDots(entry.createdAt).replace(/\./g, '')}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('保存できない場合は、画像を長押しして保存してください', 3200);
      }, 'image/png');
    },
  });
}

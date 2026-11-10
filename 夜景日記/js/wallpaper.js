// その夜のパレットから、スマートフォンの壁紙をつくる（自分のために持ち帰る）
import { sheet, esc, fmtDots, $, $$, toast } from './ui.js';
import { icon } from './icons.js';
import { inkFor, rgbToOklab } from './colors.js';

const W = 1179, H = 2556; // iPhone 15/16 の画面比率

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function drawGradient(ctx, entry) {
  const cols = entry.colors;
  // 暗い色を上に、明るい色を下に並べると夜空らしくなる
  const sorted = [...cols].sort((a, b) => rgbToOklab(a.rgb)[0] - rgbToOklab(b.rgb)[0]);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (sorted.length === 1) { g.addColorStop(0, '#0B1026'); g.addColorStop(1, sorted[0].hex); }
  else sorted.forEach((c, i) => g.addColorStop(0.08 + i / (sorted.length - 1) * 0.84, c.hex));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 上の方にだけ、小さな星
  const r = rnd(entry.id.length * 97 + cols.length);
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.15 + r() * 0.45; ctx.fillStyle = '#fff';
    const s = r() < 0.9 ? 2 : 4;
    ctx.fillRect(r() * W, r() * H * 0.45, s, s);
  }
  ctx.globalAlpha = 1;
  const last = sorted[sorted.length - 1];
  ctx.fillStyle = inkFor(last.rgb) === '#FFFFFF' ? 'rgba(255,255,255,.75)' : 'rgba(16,20,42,.7)';
  ctx.font = '500 36px "Hiragino Mincho ProN", "Yu Mincho", serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${fmtDots(entry.createdAt)}  ${entry.title || ''}`, W / 2, H - 150);
}

function drawStripes(ctx, entry) {
  const cols = entry.colors;
  const top = 0, h = H / cols.length;
  cols.forEach((c, i) => {
    ctx.fillStyle = c.hex; ctx.fillRect(0, top + i * h, W, h + 1);
    ctx.fillStyle = inkFor(c.rgb) === '#FFFFFF' ? 'rgba(255,255,255,.85)' : 'rgba(16,20,42,.8)';
    ctx.textAlign = 'left';
    ctx.font = '600 58px "Hiragino Mincho ProN", "Yu Mincho", serif';
    ctx.fillText(c.nickname || c.name, 90, top + (i + 1) * h - 150);
    ctx.font = '400 34px -apple-system, "Hiragino Sans", sans-serif';
    ctx.fillText(`${c.hex}   ${fmtDots(entry.createdAt)}`, 90, top + (i + 1) * h - 90);
  });
}

function render(entry, style) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  (style === 'stripes' ? drawStripes : drawGradient)(ctx, entry);
  return c;
}

export function openWallpaper(entry) {
  let style = 'gradient', canvas = render(entry, style);
  sheet(`
    <h3 class="sheet-title">この夜の色で壁紙をつくる</h3>
    <div class="seg mini wp-seg">
      <button data-style="gradient" class="on">グラデーション</button>
      <button data-style="stripes">色見本</button>
    </div>
    <div class="wp-preview"><img id="wpImg" alt="壁紙のプレビュー"></div>
    <p class="small-note center">画像を長押しして「"写真"に保存」を選ぶと、<br>iPhoneの壁紙に設定できます。</p>
    <div class="sheet-actions"><button class="btn ghost" data-close>閉じる</button><button class="btn primary" id="wpSave">${icon('download', 18)} 保存</button></div>`, {
    onMount(el) {
      const img = $('#wpImg', el);
      const show = () => { img.src = canvas.toDataURL('image/png'); };
      show();
      $$('[data-style]', el).forEach(b => b.onclick = () => {
        style = b.dataset.style;
        $$('[data-style]', el).forEach(x => x.classList.toggle('on', x === b));
        canvas = render(entry, style); show();
      });
      $('#wpSave', el).onclick = () => canvas.toBlob(async blob => {
        const file = new File([blob], `nightscape-${fmtDots(entry.createdAt).replace(/\./g, '')}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        toast('保存できない場合は、画像を長押しして保存してください', 3200);
      }, 'image/png');
    },
  });
}


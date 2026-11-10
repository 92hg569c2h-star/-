// デモ用サンプル記録。
// 写真は実在の写真ではなく、このアプリがその場で描く「夜景のイラスト」です。
// 色は描いたイラストの実際の画素から取得します（ダミーの色ではありません）。

import { preparePhoto, sampleColor } from './image.js';
import { rgbToHex, nearestName } from './colors.js';

const W = 900, H = 1200;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function vgrad(ctx, stops, y0 = 0, y1 = H) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  return g;
}
function glow(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function stars(ctx, r, n, yMax) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.25 + r() * 0.6;
    ctx.fillStyle = '#ffffff';
    const s = r() < 0.9 ? 1.2 : 2.2;
    ctx.fillRect(r() * W, r() * yMax, s, s);
  }
  ctx.globalAlpha = 1;
}
function rooftops(ctx, r, baseY, color, windows = []) {
  ctx.fillStyle = color;
  let x = -20;
  const blocks = [];
  while (x < W + 20) {
    const w = 90 + r() * 150, top = baseY - 40 - r() * 140;
    ctx.beginPath();
    if (r() < 0.55) { // 三角屋根
      ctx.moveTo(x, H); ctx.lineTo(x, top + 40); ctx.lineTo(x + w / 2, top); ctx.lineTo(x + w, top + 40); ctx.lineTo(x + w, H);
    } else {
      ctx.rect(x, top, w, H - top);
    }
    ctx.fill();
    blocks.push({ x, w, top });
    x += w - 6;
  }
  windows.forEach(([c, a]) => {
    blocks.forEach(b => {
      if (r() < 0.5) {
        ctx.globalAlpha = a; ctx.fillStyle = c;
        ctx.fillRect(b.x + 18 + r() * (b.w - 50), b.top + 60 + r() * 60, 18, 22);
        ctx.globalAlpha = 1; ctx.fillStyle = color;
      }
    });
  });
}
function wires(ctx, y, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-10, y); ctx.quadraticCurveTo(W / 2, y + 60, W + 10, y - 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, y + 26); ctx.quadraticCurveTo(W / 2, y + 90, W + 10, y + 18); ctx.stroke();
}

/* ---------- 各シーン（戻り値：色を取る位置。0〜1 の正規化座標） ---------- */
const SCENES = {
  dusk(ctx) {
    const r = rng(11);
    ctx.fillStyle = vgrad(ctx, [[0, '#121944'], [0.3, '#2E3170'], [0.52, '#7457B0'], [0.68, '#B47595'], [0.8, '#E7A07E'], [0.9, '#F2B98A']]);
    ctx.fillRect(0, 0, W, H);
    // 薄い雲
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#F6C1C0';
      ctx.beginPath(); ctx.ellipse(r() * W, 560 + r() * 160, 220 + r() * 160, 10 + r() * 10, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    stars(ctx, r, 18, 260);
    rooftops(ctx, r, 1020, '#0E1024', [['#FFCF7A', 0.9]]);
    wires(ctx, 720, 'rgba(10,10,25,0.85)');
    return [{ x: 0.5, y: 0.16 }, { x: 0.32, y: 0.47 }, { x: 0.62, y: 0.72 }];
  },
  lamp(ctx) {
    const r = rng(23);
    ctx.fillStyle = vgrad(ctx, [[0, '#070B1E'], [0.6, '#151C3A'], [1, '#1C2140']]);
    ctx.fillRect(0, 0, W, H);
    stars(ctx, r, 30, 500);
    rooftops(ctx, r, 820, '#0A0E1C', [['#F4C978', 0.75]]);
    // 道路
    ctx.fillStyle = '#101321';
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(260, 860); ctx.lineTo(640, 860); ctx.lineTo(W, H); ctx.fill();
    // 地面の光だまり
    ctx.save(); ctx.translate(470, 1010); ctx.scale(1.9, 0.55);
    glow(ctx, 0, 0, 230, 'rgba(232,150,70,0.95)', 0.9);
    ctx.restore();
    // ポール
    ctx.fillStyle = '#05070F';
    ctx.fillRect(612, 360, 14, 640);
    ctx.fillRect(500, 352, 126, 12);
    // 灯具と光
    glow(ctx, 520, 380, 360, 'rgba(255,170,80,0.55)');
    glow(ctx, 520, 380, 120, 'rgba(255,196,120,0.95)');
    ctx.fillStyle = '#FFE6B5'; ctx.fillRect(492, 362, 56, 14);
    return [{ x: 0.575, y: 0.345 }, { x: 0.5, y: 0.845 }, { x: 0.2, y: 0.12 }];
  },
  moon(ctx) {
    const r = rng(37);
    ctx.fillStyle = vgrad(ctx, [[0, '#060A22'], [0.55, '#14204A'], [1, '#2A3866']]);
    ctx.fillRect(0, 0, W, H);
    stars(ctx, r, 90, 800);
    glow(ctx, 610, 300, 300, 'rgba(210,215,255,0.28)');
    glow(ctx, 610, 300, 110, 'rgba(255,248,220,0.6)');
    ctx.fillStyle = '#F6EDCB';
    ctx.beginPath(); ctx.arc(610, 300, 62, 0, Math.PI * 2); ctx.fill();
    // 月にかかる雲
    for (let i = 0; i < 7; i++) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = i % 2 ? '#5D6890' : '#6E79A0';
      ctx.beginPath(); ctx.ellipse(240 + i * 70, 450 + (i % 3) * 18, 170, 34, -0.05, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#C9C7C8';
    ctx.beginPath(); ctx.ellipse(560, 420, 150, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 木と電柱
    ctx.fillStyle = '#05060F';
    for (let i = 0; i < 14; i++) {
      ctx.beginPath(); ctx.arc(60 + i * 30 + r() * 20, 1010 - r() * 120, 60 + r() * 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillRect(0, 1040, W, 200);
    ctx.fillRect(760, 600, 12, 500); ctx.fillRect(720, 640, 92, 8);
    return [{ x: 0.678, y: 0.25 }, { x: 0.34, y: 0.375 }, { x: 0.2, y: 0.18 }];
  },
  rain(ctx) {
    const r = rng(53);
    ctx.fillStyle = vgrad(ctx, [[0, '#0B0E22'], [0.45, '#1A1E38'], [0.5, '#13172B'], [1, '#0E1122']]);
    ctx.fillRect(0, 0, W, H);
    // 建物
    ctx.fillStyle = '#0A0C1A';
    [[0, 160, 300], [280, 260, 220], [480, 120, 240], [700, 220, 220]].forEach(([x, top, w]) => ctx.fillRect(x, top, w, 460 - top + 120));
    // 光源（看板や街灯）
    const lights = [
      { x: 200, y: 330, w: 150, h: 50, c: '#A37CFF' },
      { x: 590, y: 280, w: 120, h: 36, c: '#59D0D9' },
      { x: 660, y: 470, w: 20, h: 20, c: '#FFA552', lamp: true },
      { x: 380, y: 420, w: 80, h: 26, c: '#FFE3A8' },
    ];
    // 地面の境目
    const horizon = 580;
    ctx.fillStyle = vgrad(ctx, [[0, '#1B1F35'], [1, '#0F1224']], horizon, H);
    ctx.fillRect(0, horizon, W, H - horizon);
    lights.forEach(L => {
      if (L.lamp) { glow(ctx, L.x, L.y, 160, 'rgba(255,165,82,0.6)'); glow(ctx, L.x, L.y, 40, 'rgba(255,220,170,1)'); }
      else { glow(ctx, L.x, L.y, L.w, L.c, 0.35); ctx.fillStyle = L.c; ctx.fillRect(L.x - L.w / 2, L.y - L.h / 2, L.w, L.h); }
      // 映り込み：縦に伸びるにじみ（何層も重ねてぼかしを表現）
      const ry0 = horizon + (horizon - L.y) * 0.15;
      for (let k = 0; k < 7; k++) {
        const ww = (L.lamp ? 40 : L.w * 0.7) + k * 14;
        const g = ctx.createLinearGradient(0, ry0, 0, H);
        g.addColorStop(0, L.c); g.addColorStop(0.75, L.c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.16; ctx.fillStyle = g;
        ctx.fillRect(L.x - ww / 2 + (r() - 0.5) * 6, ry0, ww, H - ry0);
      }
      ctx.globalAlpha = 1;
    });
    // 水たまりのゆらぎ
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#0B0D1C';
      ctx.fillRect(r() * W, horizon + r() * (H - horizon), 40 + r() * 140, 3);
    }
    ctx.globalAlpha = 1;
    return [{ x: 0.222, y: 0.7 }, { x: 0.733, y: 0.74 }, { x: 0.5, y: 0.96 }];
  },
  window(ctx) {
    const r = rng(71);
    ctx.fillStyle = vgrad(ctx, [[0, '#1A2550'], [0.22, '#33467E'], [0.3, '#3F5389']]);
    ctx.fillRect(0, 0, W, H);
    // 建物
    const bx = 70, by = 240, bw = 760, cols = 6, rows = 9;
    ctx.fillStyle = '#1C2236'; ctx.fillRect(bx, by, bw, H - by);
    ctx.fillStyle = '#161B2C'; ctx.fillRect(bx, by, bw, 18);
    const cw = bw / cols, ch = 100;
    const palette = ['#FFD27F', '#FFE6B0', '#FFB870', '#FFD27F', '#CFE3FF'];
    const picks = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const x = bx + col * cw + 22, y = by + 40 + row * ch, w = cw - 44, hh = ch - 40;
      const lit = r() < 0.55;
      let c = lit ? palette[Math.floor(r() * palette.length)] : '#10142A';
      if (row === 3 && col === 1) c = '#FFC46B';
      if (row === 5 && col === 4) c = '#FFEBC2';
      ctx.fillStyle = c; ctx.fillRect(x, y, w, hh);
      if (lit || (row === 3 && col === 1) || (row === 5 && col === 4)) {
        glow(ctx, x + w / 2, y + hh / 2, w * 0.9, c, 0.18);
        // カーテンの影
        ctx.fillStyle = 'rgba(80,40,20,0.18)'; ctx.fillRect(x, y, w * 0.28, hh);
      }
      // 手すり
      ctx.fillStyle = '#121626'; ctx.fillRect(x - 10, y + hh + 6, w + 20, 10);
      if (row === 3 && col === 1) picks[0] = { x: (x + w * 0.65) / W, y: (y + hh / 2) / H };
      if (row === 5 && col === 4) picks[1] = { x: (x + w * 0.65) / W, y: (y + hh / 2) / H };
    }
    picks[2] = { x: 0.5, y: 0.12 };
    return picks;
  },
};

const SAMPLE_DEFS = [
  { scene: 'dusk', daysAgo: 12, time: [17, 52], title: '帰り道、空が藤色だった', memo: '駅を出たら、空の上の方だけが深い青で、下の方はまだ明るかった。', tags: ['夕暮れ', '夜空', '帰り道'] },
  { scene: 'window', daysAgo: 12, time: [19, 34], title: '団地の窓明かり', memo: '同じ黄色に見えて、一つひとつ少しずつ違う色だった。', tags: ['窓明かり', '建物', '帰り道'] },
  { scene: 'lamp', daysAgo: 27, time: [21, 40], title: 'いつもの角の街灯', memo: 'オレンジの光が、道の上で丸く広がっていた。', tags: ['街灯', '帰り道'] },
  { scene: 'moon', daysAgo: 19, time: [20, 15], title: '雲の向こうの月', memo: 'コンビニを出たら、雲の切れ間に月。', tags: ['月', '夜空'] },
  { scene: 'rain', daysAgo: 4, time: [22, 5], title: '雨上がりの交差点', memo: '水たまりに看板の紫が映っていた。', tags: ['雨上がり', '反射', '街灯'] },
];

/** サンプル記録を作る。既存の利用者の記録には一切触れない */
export async function buildSamples() {
  const out = [];
  for (const def of SAMPLE_DEFS) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const picks = SCENES[def.scene](ctx);
    const photo = await preparePhoto(c);
    const imgData = photo.canvas.getContext('2d').getImageData(0, 0, photo.width, photo.height);
    const colors = picks.map((p, i) => {
      const rgb = sampleColor(imgData, p.x * photo.width, p.y * photo.height, 'avg');
      return { id: `c${i + 1}`, hex: rgbToHex(rgb), rgb, name: nearestName(rgb), nickname: '', x: p.x, y: p.y, mode: 'avg' };
    });
    const d = new Date();
    d.setDate(d.getDate() - def.daysAgo);
    d.setHours(def.time[0], def.time[1], 0, 0);
    out.push({
      entry: {
        id: `sample-${def.scene}`, sample: true,
        createdAt: d.toISOString(), updatedAt: new Date().toISOString(),
        title: def.title, memo: def.memo, tags: def.tags, colors,
        width: photo.width, height: photo.height, letterId: null,
      },
      photo: { full: photo.fullBlob, thumb: photo.thumbBlob },
    });
  }
  return out;
}

// 色の計算まわり：OKLab 変換、色名の近似、色系統の分類、似た色の判定
// 人間の見え方に近い OKLab 色空間で距離を測ります。

/* ---------- 基本変換 ---------- */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function rgbToOklab([r, g, b]) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
export function oklch(rgb) {
  const [L, a, b] = rgbToOklab(rgb);
  const C = Math.hypot(a, b);
  let H = Math.atan2(b, a) * 180 / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}
/** OKLab でのユークリッド距離 ×100（およそ 2 で「見分けがつく」、10 以内で「似ている」） */
export function deltaE(rgb1, rgb2) {
  const a = rgbToOklab(rgb1), b = rgbToOklab(rgb2);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
}

/* ---------- 色名の判定 ----------
   1. 写真の画素から取った sRGB をそのまま使う（HEXは変えない）
   2. sRGB → CIE XYZ（D65）→ CIE L*a*b* に変換
   3. 色名データ（colornames.js）の全色との色差を CIEDE2000 で計算
   4. いちばん近い色名を「近い色名」として返す。差が大きいときは「暗い」「くすんだ」などを添える */
import { COLOR_NAMES } from './colornames.js';

export function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  let X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  let Y = (0.2126729 * R + 0.7151522 * G + 0.0721750 * B) / 1.0;
  let Z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  X = f(X); Y = f(Y); Z = f(Z);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** CIEDE2000 色差（1前後で見分けられる差、5〜10で「近いが違う色」） */
export function ciede2000(lab1, lab2) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b, a) => { if (a === 0 && b === 0) return 0; const v = Math.atan2(b, a) * deg; return v < 0 ? v + 360 : v; };
  const h1p = h(b1, a1p), h2p = h(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2 * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360; hbp /= 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

const NAMES = COLOR_NAMES.map(([name, hex, src]) => ({ name, hex, src, lab: rgbToLab(hexToRgb(hex)) }));

/** 色名の判定結果：{ name（表示名）, base（データ上の色名）, hex（その色名の代表色）, dE（色差）, src } */
export function nameColor(rgb) {
  const lab = rgbToLab(rgb);
  let best = null, bestD = Infinity;
  for (const n of NAMES) {
    const d = ciede2000(lab, n.lab);
    if (d < bestD) { bestD = d; best = n; }
  }
  let name = best.name;
  // 差が大きいときは、どちらにずれているかを添える（例：暗い藍色）
  if (bestD > 6) {
    const dL = lab[0] - best.lab[0];
    const dC = Math.hypot(lab[1], lab[2]) - Math.hypot(best.lab[1], best.lab[2]);
    const cand = [[dL < -6, -dL, '暗い'], [dL > 6, dL, '明るい'], [dC < -8, -dC, 'くすんだ'], [dC > 8, dC, '鮮やかな']]
      .filter(c => c[0]).sort((x, y) => y[1] - x[1]);
    if (cand.length) name = cand[0][2] + name;
  }
  return { name, base: best.name, hex: best.hex, dE: Math.round(bestD * 10) / 10, src: best.src };
}

/** いちばん近い色名（表示用の文字列） */
export function nearestName(rgb) { return nameColor(rgb).name; }

/** 色名から HEX（手紙の「見つけやすい色」用） */
export function hexOfName(name) {
  const n = NAMES.find(x => x.name === name);
  return n ? n.hex : null;
}

export const COLOR_NAMES_VERSION = 2;

/* ---------- 色系統 ---------- */
export const FAMILIES = [
  { key: 'blue', label: '青', sample: '#4C6CB3' },
  { key: 'purple', label: '紫', sample: '#8D6CC8' },
  { key: 'red', label: '赤・ピンク', sample: '#E06070' },
  { key: 'orange', label: 'オレンジ', sample: '#F39800' },
  { key: 'yellow', label: '黄', sample: '#F5D35B' },
  { key: 'green', label: '緑', sample: '#3EB370' },
  { key: 'neutral', label: '無彩色', sample: '#9A9AA6' },
];
export function familyOf(rgb) {
  const { C, H, L } = oklch(rgb);
  // 暗い色ほど彩度が小さく出るので、明度に応じてしきい値を下げる
  const th = L < 0.25 ? 0.022 : 0.035;
  if (C < th) return 'neutral';
  if (H >= 330 || H < 40) return 'red';
  if (H < 75) return 'orange';
  if (H < 112) return 'yellow';
  if (H < 175) return 'green';
  if (H < 278) return 'blue';
  return 'purple';
}
export function familyLabel(key) {
  return (FAMILIES.find(f => f.key === key) || {}).label || '';
}

/** 表示用：色相で並べるためのキー（無彩色は最後に） */
export function hueKey(rgb) {
  const { C, H, L } = oklch(rgb);
  if (familyOf(rgb) === 'neutral') return 1000 + (1 - L);
  // 赤をはじまりにするため 330 度で回す
  return ((H - 330 + 360) % 360) + (1 - L) * 0.01 + C * 0;
}

/** 文字色（背景色に対して読みやすい方） */
export function inkFor(rgb) {
  return rgbToOklab(rgb)[0] > 0.68 ? '#10142A' : '#FFFFFF';
}

export const SIMILAR_THRESHOLD = 9;

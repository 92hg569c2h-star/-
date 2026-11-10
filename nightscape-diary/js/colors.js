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

/* ---------- 色名データ（近似名として使用） ---------- */
const NAMES = [
  ['漆黒', '#0D0015'], ['濡羽色', '#141420'], ['鉄紺', '#17184B'], ['濃紺', '#0F2350'],
  ['ミッドナイトブルー', '#191970'], ['紺青', '#192F60'], ['プルシアンブルー', '#003153'],
  ['インディゴ', '#043C78'], ['ネイビー', '#202F55'], ['藍色', '#165E83'], ['瑠璃色', '#1E50A2'],
  ['群青', '#4C6CB3'], ['コバルトブルー', '#0047AB'], ['ロイヤルブルー', '#4169E1'],
  ['ウルトラマリン', '#4D5AAF'], ['薄花色', '#698AAB'], ['藍鼠', '#6C848D'], ['勿忘草色', '#89C3EB'],
  ['空色', '#A0D8EF'], ['水色', '#BCE2E8'], ['月白', '#EAF4FC'], ['新橋色', '#59B9C6'],
  ['浅葱色', '#00A3AF'], ['青磁色', '#7EBEA5'], ['スレートブルー', '#6A5ACD'], ['桔梗色', '#5654A2'],
  ['藤紫', '#8D93C8'], ['藤色', '#BBBCDE'], ['ラベンダー', '#A99BD6'], ['竜胆色', '#9079AD'],
  ['菫色', '#7058A3'], ['バイオレット', '#5A4498'], ['江戸紫', '#745399'], ['紫', '#884898'],
  ['モーブ', '#915DA3'], ['茄子紺', '#824880'], ['紫紺', '#460E44'], ['葡萄色', '#522F60'],
  ['薄紫', '#C0A2C7'], ['ライラック', '#C8A2C8'], ['牡丹色', '#C24DA1'], ['躑躅色', '#E95295'],
  ['マゼンタ', '#E4007F'], ['ローズ', '#E95464'], ['桃色', '#F09199'], ['鴇色', '#F4B3C2'],
  ['コーラルピンク', '#F08A7E'], ['珊瑚色', '#F5B1AA'], ['紅色', '#D7003A'], ['茜色', '#B7282E'],
  ['臙脂', '#B94047'], ['蘇芳', '#9E3D3F'], ['緋色', '#D3381C'], ['朱色', '#EB6101'],
  ['柿色', '#ED6D3D'], ['煉瓦色', '#B55233'], ['橙色', '#EE7800'], ['蜜柑色', '#F08300'],
  ['オレンジ', '#F39800'], ['杏色', '#F7B977'], ['琥珀色', '#BF783A'], ['アンバー', '#FFBF00'],
  ['山吹色', '#F8B500'], ['黄金色', '#E6B422'], ['黄土色', '#C39143'], ['卵色', '#FCD575'],
  ['クリーム色', '#FFF3B8'], ['刈安色', '#F5E56B'], ['黄色', '#FFD900'], ['象牙色', '#F8F4E6'],
  ['生成り色', '#FBFAF5'], ['萌黄', '#AACF53'], ['若草色', '#C3D825'], ['緑', '#3EB370'],
  ['常磐色', '#007B43'], ['深緑', '#00552E'], ['茶色', '#965042'], ['焦茶', '#6F4B3E'],
  ['セピア', '#6B4A2B'], ['消炭色', '#524748'], ['墨色', '#595857'], ['鈍色', '#727171'],
  ['鼠色', '#949495'], ['銀鼠', '#AFAFB0'], ['白', '#FFFFFF'], ['黒', '#2B2B2B'],
].map(([name, hex]) => ({ name, hex, lab: rgbToOklab(hexToRgb(hex)) }));

/** 色名から HEX（手紙の「見つけやすい色」用） */
export function hexOfName(name) {
  const n = NAMES.find(x => x.name === name);
  return n ? n.hex : null;
}

/** もっとも近い色名を返す（近似名） */
export function nearestName(rgb) {
  const lab = rgbToOklab(rgb);
  let best = null, bestD = Infinity;
  for (const n of NAMES) {
    const d = Math.hypot(lab[0] - n.lab[0], lab[1] - n.lab[1], lab[2] - n.lab[2]);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best.name;
}

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

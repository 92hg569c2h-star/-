// タイトルの候補づくり（端末の中だけで動く。外部のAIには送らない）
//
// 使う情報は「確かに分かっていること」だけ：
//   ・採集した色（色名・自分で付けた呼び名・色の系統・明るさ）
//   ・自分で付けたタグ（タグにある景色だけを景色として使う）
//   ・記録の日時（時間帯・曜日・季節）
//   ・天気（実際に取得できていて、記録が今日のときだけ）
// 写真に写っているか分からないもの（月・雨・夕焼けなど）は、タグか取得した天気にない限り入れない。

import { familyOf, oklch } from './colors.js';

// タグ → タイトルで使う景色の言葉（タグにないものは使わない）
const SCENE = {
  '街灯': ['街灯', '街灯の下'], '窓明かり': ['窓明かり', '窓の灯り'], '夜空': ['夜空', '空'],
  '月': ['月'], '星': ['星'], '夕暮れ': ['夕暮れ'], '雨上がり': ['雨上がりの道', '濡れた道'],
  '反射': ['映り込み', '水たまり'], '帰り道': ['帰り道', 'いつもの道'], '建物': ['建物の灯り', '街かど'],
};
const WD = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const FAM = { blue: '青', purple: '紫', red: '赤', orange: '橙', yellow: '黄', green: '緑' };
const WEATHER_WORD = { clear: '晴れた', cloudy: 'くもりの', rain: '雨の', 'after-rain': '雨上がりの' };

function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

function timeWord(h) {
  if (h >= 4 && h < 7) return '明け方';
  if (h >= 7 && h < 16) return '昼';
  if (h >= 16 && h < 19) return '夕方';
  if (h >= 19 && h < 22) return '夜';
  return '夜更け';
}
function seasonOf(m) { return m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬'; }
function colorWord(c) {
  const { L } = oklch(c.rgb);
  const f = familyOf(c.rgb);
  const noun = f === 'neutral' ? (L > 0.8 ? '白' : L < 0.3 ? '黒' : '灰') : FAM[f];
  const tone = L < 0.32 ? '深い' : L > 0.8 ? '淡い' : '';
  return { noun, tone, L };
}

/** 構成の違うタイトルのつくり方（カテゴリ・名前・つくり方） */
const PATTERNS = [
  // 景色をそのまま
  ['scene', 'time-scene', x => x.scene && `${x.time}の${x.scene}`],
  ['scene', 'two-scenes', x => x.scene2 && `${x.scene}と${x.scene2}`],
  ['scene', 'weekday-scene', x => x.scene && `${x.weekday}の${x.scene}`],
  // 色が主役
  ['color', 'color-only', x => x.c1],
  ['color', 'color-of-scene', x => `${x.c1}の${x.scene || x.time}`],
  // 時間帯
  ['time', 'date-time', x => `${x.month}月${x.day}日、${x.time}`],
  ['time', 'time-color', x => `${x.time}の色`],
  ['time', 'weekday-time', x => `${x.weekday}の${x.time}`],
  // 光や影
  ['light', 'tone-light', x => `${x.w1.tone}${x.w1.noun}の光`],
  ['light', 'dark-color', x => x.dark && `暗がりの${x.dark}`],
  ['light', 'light-and-dark', x => x.bright && x.dark && x.bright !== x.dark && `${x.bright}と、その暗がり`],
  // 偶然の発見
  ['found', 'glimpse', x => `ふと目に入った${x.c1}`],
  ['found', 'found-color', x => `${x.c1}を見つけた`],
  ['found', 'usual-place', x => `いつもの${x.scene || '道'}の${x.w1.noun}`],
  // 気持ち
  ['feel', 'stopped', x => `${x.c1}に足を止めた`],
  ['feel', 'keep', x => `残しておきたい${x.c1}`],
  // 短い一言
  ['short', 'noun-time', x => `${x.w1.noun}の${x.time}`],
  ['short', 'scene-only', x => x.scene],
  // 少し詩的に
  ['poem', 'lingers', x => `${x.c1}が残る${x.time}`],
  ['poem', 'bind', x => `${x.time}を、${x.c1}で綴じる`],
  ['poem', 'afterglow', x => `${x.c1}の余韻`],
  // 天気や季節
  ['season', 'season-time-color', x => `${x.season}の${x.time}の${x.w1.noun}`],
  ['season', 'season-scene', x => x.scene && `${x.season}の${x.scene}`],
  ['season', 'weather-scene', x => x.weather && `${x.weather}${x.time}`],
  // 色の組み合わせ
  ['combo', 'two-colors', x => x.c2 && `${x.c1}と${x.c2}`],
  ['combo', 'three-colors', x => x.c3 && `${x.c1}、${x.c2}、${x.c3}`],
  ['combo', 'between', x => x.w2 && x.w1.noun !== x.w2.noun && `${x.w1.noun}と${x.w2.noun}のあいだ`],
  ['combo', 'gradient', x => x.dark && x.bright && x.dark !== x.bright && `${x.dark}から${x.bright}へ`],
];
export const TITLE_PATTERN_COUNT = PATTERNS.length;

/**
 * ctx: { colors:[{name,nickname,rgb}], tags:[], date:Date, weather:'clear'|...|null（実際に取得した今日の天気だけ） }
 * exclude: すでに見せた候補（出し直しで同じものを出さない）
 * 戻り値：カテゴリの違う候補を count 個
 */
export function titleIdeas(ctx, count = 3, seed = Date.now(), exclude = new Set()) {
  const r = rng(seed);
  const names = ctx.colors.map(c => c.nickname || c.name);
  const scenes = [];
  ctx.tags.forEach(t => { const s = SCENE[t] || [t]; scenes.push(pick(s, r)); });
  const sc = [...new Set(scenes)].sort(() => r() - 0.5);
  const d = ctx.date;
  const byL = ctx.colors.map((c, i) => ({ name: names[i], L: oklch(c.rgb).L })).sort((a, b) => a.L - b.L);
  const x = {
    c1: names[0], c2: names[1], c3: names[2],
    w1: ctx.colors[0] ? colorWord(ctx.colors[0]) : null, w2: ctx.colors[1] ? colorWord(ctx.colors[1]) : null,
    dark: byL.length && byL[0].L < 0.45 ? byL[0].name : null,
    bright: byL.length && byL[byL.length - 1].L > 0.55 ? byL[byL.length - 1].name : null,
    scene: sc[0], scene2: sc[1],
    time: timeWord(d.getHours()), weekday: WD[d.getDay()], month: d.getMonth() + 1, day: d.getDate(),
    season: seasonOf(d.getMonth() + 1),
    weather: ctx.weather ? WEATHER_WORD[ctx.weather] : null,
  };
  // 色がないときは、色を使わないつくり方だけ
  const usable = PATTERNS.filter(([, , f]) => {
    if (!x.c1 && /c1|w1|dark|bright/.test(f.toString())) return false;
    return true;
  });
  const shuffled = usable.map(p => [r(), p]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
  const out = [], usedCats = new Set();
  for (const pass of [0, 1]) {
    for (const [cat, , f] of shuffled) {
      if (out.length >= count) break;
      if (pass === 0 && usedCats.has(cat)) continue;
      const t = f(x);
      if (!t || t.length > 24 || out.includes(t) || exclude.has(t)) continue;
      out.push(t); usedCats.add(cat);
    }
  }
  return out;
}

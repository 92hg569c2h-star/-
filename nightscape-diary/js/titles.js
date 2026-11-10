// タイトルの候補づくり（端末の中だけで動く。外部のAIには送らない）
// 採集した色の名前・タグ・日時・天気・手紙のテーマを組み合わせて、短いタイトルを作る。

const PLACE = {
  '街灯': ['街灯', '角の街灯', '街灯の下'], '窓明かり': ['窓明かり', '団地の窓', 'カーテン越しの灯り'],
  '夜空': ['夜空', '帰り道の空'], '月': ['月', '雲の向こうの月'], '星': ['星', '街の星'],
  '夕暮れ': ['夕暮れ', '日没のあと'], '雨上がり': ['雨上がりの道', '水たまり'], '反射': ['水たまり', '濡れた道路'],
  '帰り道': ['帰り道', 'いつもの道'], '建物': ['街かど', '駅前', 'ビルの灯り'],
};
const WD = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

/**
 * ctx: { colors:[{name,nickname}], tags:[], date:Date, weather:'clear'|'cloudy'|'rain'|'after-rain'|null, theme }
 * 戻り値：重ならない候補を count 個
 */
export function titleIdeas(ctx, count = 3, seed = Date.now()) {
  const r = rng(seed);
  const names = ctx.colors.map(c => c.nickname || c.name);
  const places = ctx.tags.flatMap(t => PLACE[t] || [t]);
  const h = ctx.date.getHours();
  const time = h >= 16 && h < 19 ? ['夕暮れ', '日没のあと', '帰り道の夕方'] : h >= 19 || h < 4 ? ['夜', '帰り道の夜', '夜道'] : ['空'];
  const weather = { 'after-rain': '雨上がり', rain: '雨の夜', cloudy: 'くもりの夜', clear: '晴れた夜' }[ctx.weather] || null;
  if (!places.length) places.push(...time, ...(ctx.theme ? [ctx.theme] : []));
  const col = () => names.length ? pick(names, r) : null;
  const pl = () => pick(places, r);
  const month = `${ctx.date.getMonth() + 1}月`;
  const makers = [
    () => col() && `${pl()}の${col()}`,
    () => col() && `${pick(time, r)}、${col()}を見つけた`,
    () => `${WD[ctx.date.getDay()]}の${pl()}`,
    () => names.length >= 2 && `${names[0]}と${names[1]}`,
    () => weather && col() && `${weather}の${col()}`,
    () => `${month}の${pl()}`,
    () => col() && `${col()}の夜`,
    () => `${pl()}で立ち止まった`,
    () => weather && `${weather}、${pl()}`,
    () => col() && `いつもの${pick(['道', '角', '帰り道'], r)}の${col()}`,
  ];
  const out = new Set();
  for (let i = 0; i < 60 && out.size < count; i++) {
    const t = pick(makers, r)();
    if (t && t.length <= 20) out.add(t);
  }
  return [...out];
}

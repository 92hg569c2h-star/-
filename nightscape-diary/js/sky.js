// 今夜の空の情報：天気（Open-Meteo・無料／APIキー不要）、日没と「青い時間」、月齢
// 日没・月は端末内で計算するので、通信できなくても表示できます。

export const CITIES = [
  { key: 'sapporo', name: '札幌', lat: 43.06, lon: 141.35 },
  { key: 'sendai', name: '仙台', lat: 38.27, lon: 140.87 },
  { key: 'tokyo', name: '東京', lat: 35.68, lon: 139.77 },
  { key: 'yokohama', name: '横浜', lat: 35.44, lon: 139.64 },
  { key: 'saitama', name: 'さいたま', lat: 35.86, lon: 139.65 },
  { key: 'chiba', name: '千葉', lat: 35.61, lon: 140.12 },
  { key: 'niigata', name: '新潟', lat: 37.92, lon: 139.04 },
  { key: 'kanazawa', name: '金沢', lat: 36.56, lon: 136.66 },
  { key: 'nagoya', name: '名古屋', lat: 35.18, lon: 136.91 },
  { key: 'kyoto', name: '京都', lat: 35.01, lon: 135.77 },
  { key: 'osaka', name: '大阪', lat: 34.69, lon: 135.50 },
  { key: 'kobe', name: '神戸', lat: 34.69, lon: 135.19 },
  { key: 'hiroshima', name: '広島', lat: 34.39, lon: 132.46 },
  { key: 'takamatsu', name: '高松', lat: 34.34, lon: 134.05 },
  { key: 'fukuoka', name: '福岡', lat: 33.59, lon: 130.40 },
  { key: 'kagoshima', name: '鹿児島', lat: 31.60, lon: 130.56 },
  { key: 'naha', name: '那覇', lat: 26.21, lon: 127.68 },
];

export const WEATHER_LABEL = { clear: '晴れ', cloudy: 'くもり', rain: '雨', 'after-rain': '雨上がり' };

const rad = Math.PI / 180;
const pad = n => String(n).padStart(2, '0');
export const hm = d => d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '--:--';

/** 太陽が高度 alt 度を通過する時刻（夕方側）。計算できない日は null */
function sunTime(date, lat, lon, alt, rising = false) {
  const start = new Date(date.getFullYear(), 0, 0);
  const N = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
  const lngHour = lon / 15;
  const t = N + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
  L = (L + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
  RA = (RA + 360) % 360;
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
  RA /= 15;
  const sinDec = 0.39782 * Math.sin(L * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(alt * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return null;
  let H = Math.acos(cosH) / rad;
  if (rising) H = 360 - H;
  H /= 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = ((T - lngHour) % 24 + 24) % 24;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) + UT * 3600000);
}

/** 月齢と、帰り道で見えるかの目安 */
export function moonInfo(now, sunset) {
  const syn = 29.530588853;
  const age = (((now - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % syn + syn) % syn;
  let name;
  if (age < 1.8 || age >= 28.2) name = '新月';
  else if (age < 5.5) name = '三日月';
  else if (age < 9.4) name = '上弦の月';
  else if (age < 13.5) name = '満ちていく月';
  else if (age < 16.3) name = '満月';
  else if (age < 20.3) name = '欠けていく月';
  else if (age < 24.2) name = '下弦の月';
  else name = '有明の月';
  const plus = (d, min) => new Date(d.getTime() + min * 60000);
  let when, visible = true, dir = '', mark = null;
  if (age < 1.8 || age >= 24.2) { when = '今夜は月がほとんど見えない夜です'; visible = false; }
  else if (age < 5.5) { mark = { label: '月の入り', time: plus(sunset, age * 49) }; when = `夕方、西の低い空に細い月。${hm(mark.time)}ごろに沈みます`; dir = '西の低い空'; }
  else if (age < 9.5) { mark = { label: '月の入り', time: plus(sunset, age * 49) }; when = `夕方は南の空に。${hm(mark.time)}ごろまで見えます`; dir = '南の空'; }
  else if (age < 13.5) { when = '夕方に南東〜南の空。夜遅くまで見えます'; dir = '南東〜南の空'; }
  else if (age < 16.5) { when = '日没のころ東から昇り、一晩じゅう見えます'; dir = '東の低い空'; }
  else if (age < 20.5) { mark = { label: '月の出', time: plus(sunset, (age - 14.8) * 49) }; when = `${hm(mark.time)}ごろ、東の低い空から昇ります`; dir = '東の低い空'; }
  else { when = '夜中すぎに昇るので、帰り道では見えにくい夜です'; visible = false; }
  const illum = Math.round((1 - Math.cos(2 * Math.PI * age / syn)) / 2 * 100);
  return { age: Math.round(age * 10) / 10, name, when, visible, dir, illum, mark };
}

/** 日没・青い時間・暗くなる時刻 */
export function sunInfo(now, lat, lon) {
  const sunset = sunTime(now, lat, lon, -0.833);
  const blueStart = sunTime(now, lat, lon, -4);
  const blueEnd = sunTime(now, lat, lon, -8);
  const dark = sunTime(now, lat, lon, -12);
  return { sunset, blueStart, blueEnd, dark };
}

/* ---------- 天気（Open-Meteo） ---------- */
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

export async function fetchWeather(lat, lon, now = new Date()) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&hourly=weather_code,precipitation,cloud_cover,temperature_2m&timezone=Asia%2FTokyo&past_days=1&forecast_days=2';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('weather ' + res.status);
    const j = await res.json();
    const h = j.hourly;
    const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
    const i = h.time.indexOf(key);
    if (i < 0) throw new Error('no hour');
    const range = (a, b) => h.precipitation.slice(Math.max(0, a), b);
    const codes = h.weather_code.slice(i, i + 3);
    const rainSoon = range(i, i + 3).some(p => p >= 0.2) || codes.some(c => RAIN_CODES.has(c) || SNOW_CODES.has(c));
    const rainedBefore = range(i - 8, i).reduce((s, p) => s + p, 0) >= 0.5;
    const snow = codes.some(c => SNOW_CODES.has(c));
    let cond = 'clear';
    if (rainSoon) cond = 'rain';
    else if (rainedBefore) cond = 'after-rain';
    else if (h.cloud_cover[i] >= 70) cond = 'cloudy';
    return {
      cond, label: snow && cond === 'rain' ? '雪' : WEATHER_LABEL[cond],
      temp: Math.round(h.temperature_2m[i]), cloud: h.cloud_cover[i],
      fetchedAt: now.toISOString(),
    };
  } finally { clearTimeout(timer); }
}

/**
 * 今夜の空をまとめて返す。
 * settings: { cityKey, geo:{lat,lon,name}?, mode:'auto'|'manual', manual:'clear'|... }
 * cache: 前回の取得結果（1時間以内なら再利用）
 */
export async function tonightSky(settings, cache, now = new Date()) {
  const city = settings.geo || CITIES.find(c => c.key === settings.cityKey) || CITIES.find(c => c.key === 'tokyo');
  const sun = sunInfo(now, city.lat, city.lon);
  const moon = moonInfo(now, sun.sunset || now);
  let weather = null, source = 'none', newCache = cache;
  if (settings.mode === 'manual' && settings.manual) {
    weather = { cond: settings.manual, label: WEATHER_LABEL[settings.manual], temp: null };
    source = 'manual';
  } else {
    const fresh = cache && cache.city === city.name && (now - new Date(cache.data.fetchedAt)) < 60 * 60000;
    if (fresh) { weather = cache.data; source = 'open-meteo'; }
    else {
      try {
        weather = await fetchWeather(city.lat, city.lon, now);
        source = 'open-meteo';
        newCache = { city: city.name, data: weather };
      } catch (e) {
        // 通信できないときは、3時間以内の前回の結果を使う
        if (cache && cache.city === city.name && (now - new Date(cache.data.fetchedAt)) < 3 * 3600000) { weather = cache.data; source = 'open-meteo'; }
      }
    }
  }
  return {
    city: city.name, weather, source, cache: newCache,
    sun, moon,
    // 文章に差し込む用の文字列
    t: {
      sunset: hm(sun.sunset), blue: `${hm(sun.blueStart)}〜${hm(sun.blueEnd)}`,
      blueStart: hm(sun.blueStart), blueEnd: hm(sun.blueEnd), dark: hm(sun.dark),
      afterSunset: m => hm(new Date(sun.sunset.getTime() + m * 60000)),
    },
  };
}

/** 時間帯：dusk（日没の1時間前〜暗くなるまで） / night / day */
export function bucketOf(sky, now = new Date()) {
  const { sunset, dark } = sky.sun;
  if (!sunset) return 'night';
  if (now < new Date(sunset.getTime() - 3 * 3600000)) return 'day';
  if (now < dark) return 'dusk';
  return 'night';
}

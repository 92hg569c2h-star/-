// アプリ全体の状態（IndexedDB の内容をメモリにも保持し、画面はここから描く）
import { db } from './db.js';
import { buildSamples } from './samples.js';
import { deltaE, familyOf, hueKey, SIMILAR_THRESHOLD, nearestName, COLOR_NAMES_VERSION } from './colors.js';

export const PRESET_TAGS = ['夜空', '月', '星', '街灯', '窓明かり', '夕暮れ', '雨上がり', '反射', '帰り道', '建物'];

/** 容量不足による失敗かどうか（ブラウザによって名前が違う） */
export function isQuota(err) {
  const n = err && (err.name || '') + ' ' + (err.message || '');
  return /Quota|quota|NS_ERROR_DOM_QUOTA|disk|space/i.test(n || '');
}

export const store = {
  entries: [],
  meta: {},
  urls: new Map(), // id -> { thumb, full }

  async init() {
    this.meta = await db.allMeta();
    // サンプルの準備に失敗しても、自分の記録は必ず読み込めるようにする
    try {
      if (!this.meta.seeded) {
        await this.addSamples();
        await this.setMeta('seeded', true);
      } else {
        await this.updateSamplesIfNeeded();
      }
    } catch (err) { console.warn('samples', err); }
    // 以前の版で保存した現在地（約1km単位）を、約10km単位に丸め直す
    const g = this.meta.geo;
    if (g && (g.lat !== +(+g.lat).toFixed(1) || g.lon !== +(+g.lon).toFixed(1))) {
      await this.setMeta('geo', { ...g, lat: +(+g.lat).toFixed(1), lon: +(+g.lon).toFixed(1) });
    }
    this.entries = await db.allEntries();
    await this.migrateSpecimens();
    await this.migrateColorNames();
  },

  /* ---------- 色名の付け直し ----------
     色名データを更新したときに、保存済みの色の「自動の色名」だけを新しい判定で付け直す。
     HEX・RGB・採集位置・自分で付けた呼び名は変えない。 */
  async migrateColorNames() {
    if (this.meta.colorNamesV === COLOR_NAMES_VERSION) return;
    for (const e of this.entries) {
      if (!(e.colors || []).length) continue;
      const colors = e.colors.map(c => ({ ...c, name: nearestName(c.rgb) }));
      if (colors.some((c, i) => c.name !== e.colors[i].name)) await db.saveEntry({ ...e, colors });
    }
    await this.setMeta('colorNamesV', COLOR_NAMES_VERSION);
    this.entries = await db.allEntries();
  },

  /* ---------- 標本番号 ----------
     自分で採集した色だけに、採集した順で No.001 から番号を振る（サンプルは番号なし）。
     番号は保存時に色へ書き込むので、記録を削除しても他の色の番号は変わらない。 */
  async migrateSpecimens() {
    let n = this.meta.specimenCount || 0;
    const legacy = [...this.entries].filter(e => !e.sample && (e.colors || []).some(c => !c.no))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const e of legacy) {
      const colors = e.colors.map(c => c.no ? c : { ...c, no: ++n });
      await db.saveEntry({ ...e, colors });
    }
    if (legacy.length) { await this.setMeta('specimenCount', n); this.entries = await db.allEntries(); }
  },
  /** 番号のまだない色に番号を振る（保存直前に呼ぶ）。戻り値：今回はじめての採集だったか */
  async assignSpecimens(colors) {
    let n = this.meta.specimenCount || 0;
    const first = n === 0 && colors.some(c => !c.no);
    const out = colors.map(c => c.no ? c : { ...c, no: ++n });
    await this.setMeta('specimenCount', n);
    return { colors: out, first };
  },
  async reload() { this.entries = await db.allEntries(); },

  async setMeta(key, value) { this.meta[key] = value; await db.setMeta(key, value); },

  entry(id) { return this.entries.find(e => e.id === id); },

  /** 手紙の題名（届いたときの文面があればそれを使う） */
  letterTitle(id) {
    const recs = Object.entries(this.meta.received || {}).filter(([, v]) => v.id === id).sort();
    const last = recs[recs.length - 1];
    if (last && last[1].rendered) return last[1].rendered.title;
    return null;
  },

  /* ---------- 今夜の空（天気・日没・月） ---------- */
  skySettings() {
    return {
      cityKey: this.meta.city || 'tokyo', geo: this.meta.geo || null,
      mode: this.meta.weatherMode || 'auto', manual: this.meta.manualWeather || 'clear',
    };
  },
  async getSky(force = false) {
    const now = new Date();
    if (!force && this._sky && now - this._skyAt < 15 * 60000) return this._sky;
    const { tonightSky } = await import('./sky.js');
    const sky = await tonightSky(this.skySettings(), this.meta.skyCache, now);
    if (sky.cache !== this.meta.skyCache) await this.setMeta('skyCache', sky.cache);
    this._sky = sky; this._skyAt = now;
    return sky;
  },

  async save(entry, photo) {
    try {
      await db.saveEntry(entry, photo);
    } catch (err) {
      const e = new Error('save failed');
      e.quota = isQuota(err); e.cause = err;
      throw e;
    }
    if (photo) this.dropUrls(entry.id);
    await this.reload();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  },
  /** 保存容量の目安（取得できない環境では null） */
  async storageInfo() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) return null;
      const { usage, quota } = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
      return { usage, quota, persisted, ratio: quota ? usage / quota : 0 };
    } catch { return null; }
  },
  async remove(id) {
    await db.deleteEntry(id);
    this.dropUrls(id);
    await this.reload();
  },

  hasSamples() { return this.entries.some(e => e.sample); },
  /** サンプルを入れる（今あるサンプルだけを入れ替える。自分の記録には触れない） */
  async addSamples(manifest) {
    const { version, list } = await buildSamples(manifest);
    if (!list.length) return 0;
    const current = await db.allEntries();
    for (const e of current.filter(e => e.sample)) { await db.deleteEntry(e.id); this.dropUrls(e.id); }
    const userIds = new Set(current.filter(e => !e.sample).map(e => e.id));
    for (const s of list) if (!userIds.has(s.entry.id)) await db.saveEntry(s.entry, s.photo);
    await this.setMeta('samplesV', version);
    await this.setMeta('samplesRemoved', false);
    await this.reload();
    return list.length;
  },
  async removeSamples() {
    for (const e of this.entries.filter(e => e.sample)) { await db.deleteEntry(e.id); this.dropUrls(e.id); }
    await this.setMeta('samplesRemoved', true);
    await this.reload();
  },
  /** サンプルの一覧（samples.json）の版が上がっていたら、サンプルだけを入れ替える。自分で削除した場合は戻さない */
  async updateSamplesIfNeeded() {
    if (this.meta.samplesRemoved) return;
    try {
      const { loadSampleManifest } = await import('./samples.js');
      const m = await loadSampleManifest();
      if ((m.version || 1) !== (this.meta.samplesV || 1)) await this.addSamples(m);
    } catch (e) { console.warn('サンプルの更新を確認できませんでした', e); }
  },

  /* ---------- 写真の URL ---------- */
  async photoUrl(id, kind = 'thumb') {
    let u = this.urls.get(id);
    if (!u) { u = {}; this.urls.set(id, u); }
    if (u[kind]) return u[kind];
    const p = await db.getPhoto(id);
    if (!p) return '';
    u[kind] = URL.createObjectURL(p[kind] || p.full);
    return u[kind];
  },
  dropUrls(id) {
    const u = this.urls.get(id);
    if (u) { Object.values(u).forEach(x => URL.revokeObjectURL(x)); this.urls.delete(id); }
  },

  /* ---------- 色の派生データ ---------- */
  /** すべての採集色（記録の古い順）。no は標本番号（サンプルは null） */
  allColors() {
    const asc = [...this.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const list = [];
    asc.forEach(e => (e.colors || []).forEach(c => {
      list.push({ ...c, entryId: e.id, entry: e, family: familyOf(c.rgb), hue: hueKey(c.rgb), no: e.sample ? null : (c.no || null), sample: !!e.sample });
    }));
    return list;
  },
  ownColorCount() { return this.allColors().filter(c => !c.sample).length; },
  color(entryId, colorId) { return this.allColors().find(c => c.entryId === entryId && c.id === colorId); },

  /** 似た色（別の夜景のもの）。人の見え方に近い OKLab の距離で判定 */
  similarTo(target, limit = 8) {
    return this.allColors()
      .filter(c => c.entryId !== target.entryId)
      .map(c => ({ ...c, d: deltaE(c.rgb, target.rgb) }))
      .filter(c => c.d <= SIMILAR_THRESHOLD)
      .sort((a, b) => a.d - b.d)
      .slice(0, limit);
  },
  /** 採集中の色に対して、過去の似た色をひとつ（いちばん近いもの） */
  reunionFor(rgb, excludeEntryId) {
    const best = this.allColors()
      .filter(c => c.entryId !== excludeEntryId)
      .map(c => ({ ...c, d: deltaE(c.rgb, rgb) }))
      .filter(c => c.d <= SIMILAR_THRESHOLD)
      .sort((a, b) => a.d - b.d)[0];
    return best || null;
  },

  /** 使われているタグ（件数つき） */
  tagCounts() {
    const m = new Map();
    this.entries.forEach(e => (e.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  },
  allTagNames() {
    const used = this.tagCounts().map(([t]) => t);
    const custom = this.meta.customTags || [];
    return [...new Set([...PRESET_TAGS, ...used, ...custom])];
  },
};

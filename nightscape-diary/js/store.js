// アプリ全体の状態（IndexedDB の内容をメモリにも保持し、画面はここから描く）
import { db } from './db.js';
import { buildSamples } from './samples.js';
import { deltaE, familyOf, hueKey, SIMILAR_THRESHOLD } from './colors.js';

export const PRESET_TAGS = ['夜空', '月', '星', '街灯', '窓明かり', '夕暮れ', '雨上がり', '反射', '帰り道', '建物'];

export const store = {
  entries: [],
  meta: {},
  urls: new Map(), // id -> { thumb, full }

  async init() {
    this.meta = await db.allMeta();
    if (!this.meta.seeded) {
      await this.addSamples();
      await this.setMeta('seeded', true);
    }
    this.entries = await db.allEntries();
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
    await db.saveEntry(entry, photo);
    if (photo) this.dropUrls(entry.id);
    await this.reload();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  },
  async remove(id) {
    await db.deleteEntry(id);
    this.dropUrls(id);
    await this.reload();
  },

  hasSamples() { return this.entries.some(e => e.sample); },
  async addSamples() {
    const existing = new Set((await db.allEntries()).map(e => e.id));
    const list = await buildSamples();
    for (const s of list) if (!existing.has(s.entry.id)) await db.saveEntry(s.entry, s.photo);
    await this.reload();
  },
  async removeSamples() {
    for (const e of this.entries.filter(e => e.sample)) { await db.deleteEntry(e.id); this.dropUrls(e.id); }
    await this.reload();
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
  /** すべての採集色（古い順に標本番号を振る） */
  allColors() {
    const asc = [...this.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const list = [];
    asc.forEach(e => (e.colors || []).forEach(c => {
      list.push({ ...c, entryId: e.id, entry: e, family: familyOf(c.rgb), hue: hueKey(c.rgb), no: list.length + 1 });
    }));
    return list;
  },
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

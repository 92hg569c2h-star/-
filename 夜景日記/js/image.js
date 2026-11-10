// 画像の読み込み・縮小・色の取得

const MAX_SIDE = 1600;   // 保存する写真の長辺
const THUMB_SIDE = 480;  // 一覧用サムネイルの長辺

export async function fileToImage(file) {
  // createImageBitmap は EXIF の向きを反映する（Safari 含む）
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fallthrough */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = reject;
    img.src = url;
  });
}

export function drawScaled(src, maxSide) {
  const w0 = src.width || src.videoWidth, h0 = src.height || src.videoHeight;
  const s = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.round(w0 * s), h = Math.round(h0 * s);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

export function canvasToBlob(canvas, quality = 0.9) {
  return new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', quality));
}

/** 写真を保存用に整える。色の取得もこの縮小後の画素から行うので、保存写真と色が一致する */
export async function preparePhoto(source) {
  const full = drawScaled(source, MAX_SIDE);
  const fullBlob = await canvasToBlob(full, 0.9);
  // 色は「保存される JPEG」をデコードし直した画素から取る
  const decoded = await blobToCanvas(fullBlob);
  const thumbBlob = await canvasToBlob(drawScaled(decoded, THUMB_SIDE), 0.82);
  return { canvas: decoded, fullBlob, thumbBlob, width: decoded.width, height: decoded.height };
}

export async function blobToCanvas(blob) {
  const img = await fileToImage(blob);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
  return c;
}

/**
 * 画素から色を取る。mode: 'px'（1画素）/ 'avg'（周囲3×3の平均。夜の写真のノイズを抑える）
 */
export function sampleColor(imageData, x, y, mode = 'avg') {
  const { width, height, data } = imageData;
  x = Math.max(0, Math.min(width - 1, Math.floor(x)));
  y = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const r = mode === 'px' ? 0 : 1;
  let R = 0, G = 0, B = 0, n = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
    const i = (yy * width + xx) * 4;
    R += data[i]; G += data[i + 1]; B += data[i + 2]; n++;
  }
  return [Math.round(R / n), Math.round(G / n), Math.round(B / n)];
}

/* ---------- EXIF の撮影日時（あれば） ---------- */
export async function readExifDate(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xFFD8) return null;
    let off = 2;
    while (off < v.byteLength - 4) {
      const marker = v.getUint16(off);
      const size = v.getUint16(off + 2);
      if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) {
        return parseTiffDate(v, off + 10);
      }
      if ((marker & 0xFF00) !== 0xFF00) break;
      off += 2 + size;
    }
  } catch (e) { /* 読めなければ null */ }
  return null;
}
function parseTiffDate(v, start) {
  const le = v.getUint16(start) === 0x4949;
  const u16 = o => v.getUint16(start + o, le);
  const u32 = o => v.getUint32(start + o, le);
  const readIFD = (ifdOff, wanted) => {
    const n = u16(ifdOff);
    const found = {};
    for (let i = 0; i < n; i++) {
      const e = ifdOff + 2 + i * 12;
      const tag = u16(e);
      if (wanted.includes(tag)) found[tag] = { type: u16(e + 2), count: u32(e + 4), val: u32(e + 8) };
    }
    return found;
  };
  const readAscii = (ent) => {
    let s = '';
    for (let i = 0; i < ent.count - 1; i++) s += String.fromCharCode(v.getUint8(start + ent.val + i));
    return s;
  };
  const ifd0 = readIFD(u32(4), [0x8769, 0x0132]);
  let str = null;
  if (ifd0[0x8769]) {
    const ex = readIFD(ifd0[0x8769].val, [0x9003]);
    if (ex[0x9003]) str = readAscii(ex[0x9003]);
  }
  if (!str && ifd0[0x0132]) str = readAscii(ifd0[0x0132]);
  if (!str) return null;
  const m = str.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return isNaN(d) ? null : d;
}

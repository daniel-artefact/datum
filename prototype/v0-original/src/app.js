'use strict';
const $ = id => document.getElementById(id);
const DEG = 180 / Math.PI;
const COL = { wheel: '#35E0FF', crank: '#FFD23F', geo: '#FFFFFF', fit: '#C6FF4D', meas: '#FFA8E8', grid: 'rgba(255,255,255,.28)' };
const GEO = [
  { k: 'bb', grp: 'bb', name: 'Bottom bracket', short: 'BB' },
  { k: 'sn', grp: 'fit', name: 'Saddle nose', short: 'Nose', hint: 'Click the front tip of the saddle.' },
  { k: 'sr', grp: 'fit', name: 'Saddle rear', short: 'Rear', hint: 'Click the rearmost point of the saddle.' },
  { k: 'bar', grp: 'fit', name: 'Stem clamp center', short: 'Bar', hint: 'Click the center of the handlebar where the stem clamps it.' },
  { k: 'ht', grp: 'frame', name: 'Head tube, top center', short: 'HT top', hint: 'Click the tube centerline at the top edge of the head tube.' },
  { k: 'hb', grp: 'frame', name: 'Head tube, bottom center', short: 'HT bottom', hint: 'Click the tube centerline at the bottom edge of the head tube.' },
];
const ROWS = [
  ['wheelbase', 'Wheelbase', 'mm'], ['chainstay', 'Chainstay (rear center)', 'mm'], ['bbDrop', 'BB drop', 'mm'], ['bbHeight', 'BB height', 'mm'],
  ['stack', 'Stack', 'mm'], ['reach', 'Reach', 'mm'], ['headAngle', 'Head angle', '°'], ['seatAngle', 'Seat angle (from step 4)', '°'],
  ['forkOffset', 'Fork offset, measured', 'mm'], ['trail', 'Trail', 'mm'],
];
// ETERNA PROD L Drawing v11
const DRAWING_58 = { wheelbase: 1007.7, chainstay: 412, bbDrop: 75, stack: 601.4, reach: 390, headAngle: 72.7, seatAngle: 74, forkOffset: 47, trail: 58.2 };
// Saddle, bar and frame points are reconstructed from the owner's own clicks
const EXAMPLES = {
  tilted: { src: 'examples/tilted.jpg', wb: 1007.7, wbTol: 2, D: 686, tolD: 3, drawing: DRAWING_58,
    geo: { sn: [504.3, 840], sr: [341.5, 842], bar: [892.9, 886], ht: [835, 933.9], hb: [872.8, 1060.8] } },
  dead: { src: 'examples/dead-on.jpg', wb: 1007.7, wbTol: 2, D: 686, tolD: 3, drawing: DRAWING_58,
    geo: { sn: [851.5, 463.3], sr: [703.6, 462.6], bar: [1216.7, 515.2], ht: [1160.1, 561.9], hb: [1194.8, 672.2] } },
};

const S = {
  img: null, wheels: [null, null], inits: [null, null], D: 686, tolD: 3, useTire: true, wb: null, wbTol: 3, sh: null, shTol: 3, forkOffset: null, sWork: null, side: 'drive',
  flatten: true, focalMode: 'auto', f35: null, exif: null, tilt: null, tiltKey: '', rect: null, rectRaw: null,
  refs: [], geo: {}, measures: [], clickSig: 1, scale: null, vals: null, mc: null,
  bbMode: 'auto', bbDepth: 48, crank: null, crankDet: null, crankKey: '', staMode: 'auto', staManual: 73.5, sta: null, auto: {},
  sadRef: 'mid', dropTo: 'top', barD: 31.8, fg: null, fgKey: '',
  view: { mode: 'flat', z: 1, ox: 0, oy: 0 }, tool: null, pending: null, drag: null, hover: null,
  show: { wheel: true, crank: true, sta: true, grid: false }, adjust: false, flat: null, flatKey: '', handles: [], uid: 1,
};
const cv = $('cv'), ctx = cv.getContext('2d'), loupe = $('loupe'), lctx = loupe.getContext('2d');
const fmt = (v, d = 1) => (v == null || !isFinite(v)) ? '–' : v.toFixed(d);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const frontRight = () => S.side === 'drive';
// how far the located part sits out from the frame centerline: outer chainring about 48 mm, crank bolt about 70 mm (not shown to the user)
const depthFor = () => S.side === 'drive' ? 48 : 70;

// ---------- loading ----------
async function loadImage(src, preset) {
  $('busy').style.display = 'flex';
  await new Promise(r => setTimeout(r, 20));
  try {
    let buf, blob;
    if (typeof src === 'string') { const r = await fetch(src); buf = await r.arrayBuffer(); blob = new Blob([buf], { type: 'image/jpeg' }); }
    else { buf = await src.arrayBuffer(); blob = src; }
    const url = URL.createObjectURL(blob), im = new Image();
    im.src = url; await im.decode();
    const k = Math.min(1, 3000 / Math.max(im.naturalWidth, im.naturalHeight));
    const W = Math.round(im.naturalWidth * k), H = Math.round(im.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0, W, H);
    URL.revokeObjectURL(url);
    const rgba = cx.getImageData(0, 0, W, H).data;
    S.img = { canvas: c, W, H, rgba, gray: Core.toGray(rgba, W, H) };
    S.exif = Core.exifFocal(buf);
    const guess = S.exif ? (S.exif.focal35 || S.exif.focal) : null;
    Object.assign(S, { f35: guess ? Math.round(guess) : null, focalMode: 'auto', wheels: [null, null], inits: [null, null], tilt: null, tiltKey: '', rect: null,
      refs: [], geo: {}, measures: [], tool: null, pending: null, adjust: false, flat: null, flatKey: '', fg: null, fgKey: '', crankKey: '', mc: null,
      bbMode: 'auto', bbDepth: 48, side: 'drive', staMode: 'auto', staManual: 73.5, wb: null, wbTol: 3, sh: null, shTol: 3, forkOffset: null, useTire: true });
    $('focalNote').textContent = S.exif
      ? `The file says ${fmt(guess, 0)} mm${S.exif.focal35 ? ' (35 mm-equivalent)' : ''}. That is used as a starting guess, since crops and smaller sensors change the effective value.`
      : 'No focal length in the file. A long lens leaves little perspective to measure, and then this setting hardly matters.';
    findWheels();
    S.preset = preset || null; S.drawing = preset ? preset.drawing : null;
    S.storeKey = 'bpm2:' + (preset ? preset.src : src.name + ':' + src.size);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(S.storeKey) || 'null'); } catch (e) {}
    if (saved && saved.geo) {
      for (const k of ['geo', 'measures', 'bbMode', 'side', 'wb', 'wbTol', 'sh', 'shTol', 'forkOffset', 'useTire', 'D', 'tolD', 'staMode', 'staManual', 'sadRef', 'dropTo', 'barD']) if (saved[k] !== undefined) S[k] = saved[k];
      for (const r of S.measures) S.uid = Math.max(S.uid, (parseInt(String(r.id).slice(1)) || 0) + 1);
    } else if (preset) {
      for (const k in preset.geo) S.geo[k] = { p: preset.geo[k].slice(), depth: 0 };
      Object.assign(S, { wb: preset.wb, wbTol: preset.wbTol, D: preset.D, tolD: preset.tolD });
    }
    syncInputs();
    S.view.mode = 'flat';
    recompute(); fitView(); renderAll();
  } catch (e) {
    banner('That file could not be read as a photo. Try a JPEG or PNG.');
    console.error(e);
  }
  $('busy').style.display = 'none';
}
function syncInputs() {
  $('f35').value = S.f35 || ''; $('focalMode').value = S.focalMode; $('f35').disabled = S.focalMode !== 'fixed';
  $('wb').value = S.wb || ''; $('wbTol').value = S.wbTol; $('useTire').checked = S.useTire;
  $('sh').value = S.sh || ''; $('shTol').value = S.shTol; $('forkOff').value = S.forkOffset || '';
  $('tireD').value = S.D; $('tireTol').value = S.tolD;
  $('tirePreset').value = [...$('tirePreset').options].some(o => o.value === String(S.D)) ? String(S.D) : '';
  $('side').value = S.side; S.bbDepth = depthFor();
  $('staMode').value = S.staMode; $('staManual').value = S.staManual; $('staManual').disabled = S.staMode !== 'manual';
  $('barD').value = S.barD;
  $('refMid').setAttribute('aria-pressed', String(S.sadRef === 'mid')); $('refNose').setAttribute('aria-pressed', String(S.sadRef === 'nose'));
  $('dropTop').setAttribute('aria-pressed', String(S.dropTo === 'top')); $('dropCen').setAttribute('aria-pressed', String(S.dropTo === 'center'));
  $('adjWheels').setAttribute('aria-pressed', String(S.adjust));
}
function findWheels() {
  const { gray, W, H } = S.img;
  const det = Core.detectWheels(gray, W, H);
  if (det) { S.inits = det; S.wheels = det.map(d => Core.fitWheel(gray, W, H, d)); S.adjust = S.wheels.some(w => !w); }
  else {
    S.inits = [{ cx: W * 0.3, cy: H * 0.6, r: W * 0.12 }, { cx: W * 0.7, cy: H * 0.6, r: W * 0.12 }];
    S.wheels = [null, null]; S.adjust = true;
  }
  if (S.adjust) S.view.mode = 'orig';
}

// ---------- pipeline ----------
function recompute() {
  const [w0, w1] = S.wheels;
  S.rect = S.rectRaw = S.scale = S.vals = S.crank = S.sta = null; S.auto = {};
  if (!S.img || !w0 || !w1) return;
  const o = { W: S.img.W, H: S.img.H, D1: S.D, D2: S.D };
  const key = [w0.ell.cx, w0.ell.a, w1.ell.cx, w1.ell.a, w0.pts.length, w1.pts.length, S.focalMode, S.f35].join('|');
  if (key !== S.tiltKey) {
    S.tilt = Core.solveTilt(w0.pts, w1.pts, { ...o, f35: S.focalMode === 'fixed' && S.f35 ? S.f35 : null, f35Prior: S.f35 || null });
    S.tiltKey = key;
  }
  const tilt = S.flatten ? S.tilt : null;
  S.rect = Core.buildRect(w0.pts, w1.pts, tilt, o);
  S.rectRaw = Core.buildRect(w0.pts, w1.pts, null, o);
  S.refs = S.wb > 0 ? [{ id: 'wb', on: true, axle: true, name: 'Measured wheelbase', L: S.wb, tol: S.wbTol, depth: 0 }] : [];
  ensureFg();
  let sc = computeScale(S.rect, []);
  // the detectors need a rough scale even before one is entered: a 700c tire is about 680 mm
  S.sWork = sc.sx || 680 / sc.tirePx;
  locateBB(); locateSeat();
  if (S.sh > 0 && S.geo.bb && S.auto.sd) {
    for (let it = 0; it < 2; it++) {
      sc = computeScale(S.rect, [saddleRef(true)]);
      if (!sc.sx) break;
      S.sWork = sc.sx; locateSeat();
    }
  }
  S.scale = sc;
  if (!sc.sx) return;
  S.vals = geoValues(geoPoints(S.rect, tilt, sc.sx, sc.sy, 0));
}
function saddleRef(on) {
  const b = S.sta.bbR, q = Core.apply(S.rect.H, S.auto.sd[0], S.auto.sd[1]), px = Math.hypot(q[0] - b[0], q[1] - b[1]);
  return { id: 'sh', name: 'Your saddle height', px, theta: Math.atan2(q[1] - b[1], q[0] - b[0]), L: S.sh, tol: S.shTol, sigPx: 2.5, group: 'sh', on };
}
const rearIdx = () => frontRight() ? 0 : 1;
function evalRefs(rect) {
  const out = [];
  rect.wheels.forEach((wh, k) => {
    const ex = Core.ellExtents(wh.ell), sig = Math.max(0.4, 1.5 * S.wheels[k].rms), nm = (k === rearIdx() ? 'Rear' : 'Front') + ' tire Ø, ';
    out.push({ id: 'w' + k + 'h', name: nm + 'across', px: ex.w, theta: 0, L: S.D, tol: S.tolD, sigPx: sig, group: 'tire', on: S.useTire, auto: true });
    out.push({ id: 'w' + k + 'v', name: nm + 'upright', px: ex.h, theta: Math.PI / 2, L: S.D, tol: S.tolD, sigPx: sig, group: 'tire', on: S.useTire, auto: true });
  });
  for (const r of S.refs) {
    const a = rect.wheels[0].circ, b = rect.wheels[1].circ, d = Math.hypot(b.cx - a.cx, b.cy - a.cy);
    out.push({ id: r.id, name: r.name, px: d, theta: Math.atan2(b.cy - a.cy, b.cx - a.cx), L: r.L, tol: r.tol, sigPx: 0.6, group: r.id, on: r.L > 0 });
  }
  return out;
}
function computeScale(rect, extra) {
  const refs = evalRefs(rect).concat(extra || []), used = refs.filter(r => r.on);
  const a = rect.wheels[0].circ, b = rect.wheels[1].circ, wbPx = Math.hypot(b.cx - a.cx, b.cy - a.cy);
  const tirePx = refs.filter(r => r.auto).reduce((s, r) => s + r.px, 0) / 4;
  const out = { refs, used: used.length, iso: null, ani: null, sx: null, sy: null, Z: Infinity, wbPx, tirePx, shPx: (extra && extra[0]) ? extra[0].px : null };
  // how round the tires are after correction, independent of which references are used
  const tires = refs.filter(r => r.auto), hs = tires.filter(r => r.theta === 0), vs = tires.filter(r => r.theta !== 0);
  out.axisDiff = (hs[0].px + hs[1].px) / (vs[0].px + vs[1].px) - 1;
  if (!used.length) return out;
  out.iso = Core.fitScale(used, false); out.ani = Core.fitScale(used, true);
  out.sx = out.sy = out.iso.s;
  if (S.tilt && S.tilt.u > 1e-9) out.Z = out.iso.s / S.tilt.u;
  return out;
}
function ensureFg() {
  const key = S.rect.H.map(v => v.toPrecision(9)).join(',');
  if (S.fg && S.fgKey === key) return;
  S.fg = Core.warpGray(S.img.gray, S.img.W, S.img.H, S.rect.Hinv); S.fgKey = key;
}
// bike frame: origin at rear axle, x toward the front wheel, y up, mm
function bikeFrame(rect) {
  const ri = rearIdx();
  return { RA: rect.wheels[ri].circ, FA: rect.wheels[1 - ri].circ, dir: frontRight() ? 1 : -1 };
}
function toBike(p, depth, rect, tilt, sx, sy, fr) {
  const q = Core.apply(rect.H, p[0], p[1]);
  let X = fr.dir * (q[0] - fr.RA.cx) * sx, Y = -(q[1] - fr.RA.cy) * sy;
  if (depth && tilt) { // a point proud of the wheel plane appears shifted by depth * tan(tilt)
    const a = -rect.levelDeg / DEG, c = Math.cos(a), s = Math.sin(a);
    const tx = c * tilt.a - s * tilt.b, ty = s * tilt.a + c * tilt.b;
    X -= fr.dir * depth * tx; Y += depth * ty;
  }
  return [X, Y];
}
const bikeToRect = (B, fr, sc) => [fr.RA.cx + B[0] / (fr.dir * sc.sx), fr.RA.cy - B[1] / sc.sy];
function locateBB() {
  const { W, H } = S.img, fr = bikeFrame(S.rect), s = S.sWork;
  if (S.bbMode !== 'auto') return;
  const key = S.fgKey + '|' + s.toFixed(2) + '|' + S.side;
  if (S.crankKey !== key) {
    S.crankDet = S.side === 'drive' ? Core.detectCrank(S.fg, W, H, { rax: fr.RA.cx, ray: fr.RA.cy, dir: fr.dir, s }) : null;
    S.crankKey = key;
  }
  const c = S.crankDet;
  if (c && c.coverage >= 0.45 && c.rms <= 3.5) { S.geo.bb = { p: Core.apply(S.rect.Hinv, c.cx, c.cy), depth: S.bbDepth, auto: true }; S.crank = c; }
  else if (S.geo.bb && S.geo.bb.auto) delete S.geo.bb;
}
// colour of the corrected photo at a point
function rgbAtRect(x, y) {
  const { W, H, rgba } = S.img, p = Core.apply(S.rect.Hinv, x, y);
  const px = Math.min(W - 1.001, Math.max(0, p[0])), py = Math.min(H - 1.001, Math.max(0, p[1]));
  const x0 = px | 0, y0 = py | 0, fx = px - x0, fy = py - y0, i = (y0 * W + x0) * 4, j = i + W * 4, o = [0, 0, 0];
  for (let c = 0; c < 3; c++) o[c] = (rgba[i + c] * (1 - fx) + rgba[i + 4 + c] * fx) * (1 - fy) + (rgba[j + c] * (1 - fx) + rgba[j + 4 + c] * fx) * fy;
  return o;
}
// Outline of an object against its background: walk inward from tOut (background) toward tIn and
// return where the colour first leaves the background colour for good. Works for light or dark saddles.
function silhouetteEdge(x, y, dx, dy, tIn, tOut) {
  const n = Math.round(Math.abs(tOut - tIn) / 0.5), sg = tOut > tIn ? -1 : 1, cols = [];
  for (let i = 0; i <= n; i++) { const t = tOut + sg * i * 0.5; cols.push(rgbAtRect(x + dx * t, y + dy * t)); }
  const nb = Math.max(6, Math.round(n * 0.2)), bg = [0, 1, 2].map(c => Core.median(cols.slice(0, nb).map(v => v[c])));
  const d = cols.map(v => Math.hypot(v[0] - bg[0], v[1] - bg[1], v[2] - bg[2]));
  const noise = 1.4826 * Core.median(d.slice(0, nb)), thr = Math.max(28, 5 * noise), hold = 5;
  for (let i = nb; i <= n - hold; i++) {
    let ok = true; for (let k = 0; k < hold; k++) if (d[i + k] < thr) { ok = false; break; }
    if (!ok) continue;
    const plateau = Core.median(d.slice(i, Math.min(n, i + 8))), lvl = Math.max(thr * 0.6, plateau / 2);
    let j = i; while (j > 1 && d[j - 1] > lvl) j--;
    const f = d[j] !== d[j - 1] ? (lvl - d[j - 1]) / (d[j] - d[j - 1]) : 0;
    return tOut + sg * (j - 1 + Math.min(1, Math.max(0, f))) * 0.5;
  }
  return null;
}
function locateSeat() {
  const bb = S.geo.bb; if (!bb) return;
  bb.depth = S.bbDepth;
  const { W, H } = S.img, fr = bikeFrame(S.rect), s = S.sWork, sc = { sx: s, sy: s }, tilt = S.flatten ? S.tilt : null;
  const bbR = bikeToRect(toBike(bb.p, bb.depth, S.rect, tilt, sc.sx, sc.sy, fr), fr, sc);
  const R = k => S.geo[k] ? Core.apply(S.rect.H, S.geo[k].p[0], S.geo[k].p[1]) : null, sn = R('sn'), sr = R('sr');
  let t1 = 700;
  if (sn && sr) t1 = Math.min(950, Math.max(480, Math.hypot((sn[0] + sr[0]) / 2 - bbR[0], (sn[1] + sr[1]) / 2 - bbR[1]) * s - 70));
  let det = null, angle = S.staManual, auto = false;
  if (S.staMode === 'auto') {
    det = Core.detectSeatTube(S.fg, W, H, { bbx: bbR[0], bby: bbR[1], dir: fr.dir, s, t0: Math.min(380, t1 - 200), t1, guess: 73.5 });
    det.frac = det.n / det.nSt;
    det.conf = !det.ok ? 'none' : (det.rms < 1 && det.frac >= 0.45 ? 'high' : 'low');
    if (det.conf === 'high') { angle = det.anchored; auto = true; } else angle = 73.5;
  }
  const th = angle / DEG, u = [-fr.dir * Math.cos(th), -Math.sin(th)];
  S.sta = { det, angle, auto, bbR, u, end: [bbR[0] + u[0] * 820 / s, bbR[1] + u[1] * 820 / s] };
  if (sn && sr) {
    // where the seat tube line meets the saddle: start from the nose-to-rear chord, then snap to the saddle's top edge
    const ex = sr[0] - sn[0], ey = sr[1] - sn[1], den = u[0] * ey - u[1] * ex;
    if (Math.abs(den) > 1e-9) {
      const tc = ((sn[0] - bbR[0]) * ey - (sn[1] - bbR[1]) * ex) / den;
      const e = silhouetteEdge(bbR[0], bbR[1], u[0], u[1], tc - 30 / s, tc + 45 / s), t = e != null ? e : tc;
      const sdR = [bbR[0] + u[0] * t, bbR[1] + u[1] * t];
      S.auto.sd = Core.apply(S.rect.Hinv, sdR[0], sdR[1]); S.auto.sdSnap = e != null; S.sta.end = sdR;
    }
    const mx = (sn[0] + sr[0]) / 2, my = (sn[1] + sr[1]) / 2;
    const e2 = silhouetteEdge(mx, my, 0, -1, -30 / s, 45 / s);
    S.auto.mid = Core.apply(S.rect.Hinv, mx, e2 != null ? my - e2 : my); S.auto.midSnap = e2 != null;
  }
}
function geoValues(P) {
  const o = {}, FA = P.FA, h = Math.hypot, R = P.Rw;
  o.wheelbase = h(FA[0], FA[1]);
  const { bb, ht, hb, sd, sn, sr, bar } = P;
  if (bb) {
    o.chainstay = h(bb[0], bb[1]);
    o.bbDrop = -(bb[1] - FA[1] * bb[0] / FA[0]); o.bbHeight = R - o.bbDrop;
  }
  if (bb && ht) { o.stack = ht[1] - bb[1]; o.reach = ht[0] - bb[0]; }
  if (ht && hb) {
    const dx = ht[0] - hb[0], dy = ht[1] - hb[1], HA = Math.atan2(dy, -dx);
    o.headAngle = HA * DEG;
    o.forkOffset = (FA[0] - hb[0]) * Math.sin(HA) + (FA[1] - hb[1]) * Math.cos(HA);
    const off = S.forkOffset > 0 ? S.forkOffset : o.forkOffset;
    o.trail = (R * Math.cos(HA) - off) / Math.sin(HA);
  }
  if (S.sta) o.seatAngle = S.sta.angle;
  // fit
  const mid = P.mid || (sn && sr ? [(sn[0] + sr[0]) / 2, (sn[1] + sr[1]) / 2] : null);
  const ref = S.sadRef === 'nose' ? sn : mid;
  if (bb && sd) o.saddleHeight = h(sd[0] - bb[0], sd[1] - bb[1]);
  if (bb && sn) o.setbackNose = bb[0] - sn[0];
  if (sn && sr) o.saddleLen = h(sn[0] - sr[0], sn[1] - sr[1]);
  if (bb && ref) { o.Sx = bb[0] - ref[0]; o.Sy = ref[1] - bb[1]; }
  if (bb && bar) { o.Hx = bar[0] - bb[0]; o.Hy = bar[1] - bb[1]; }
  if (ref && bar) {
    o.saddleToBar = h(ref[0] - bar[0], ref[1] - bar[1]);
    o.drop = ref[1] - (bar[1] + (S.dropTo === 'top' ? S.barD / 2 : 0));
  }
  return o;
}
function geoPoints(rect, tilt, sx, sy, jitter) {
  const fr = bikeFrame(rect), P = {}, j = jitter || 0, n = k => j ? k * Core.randn() : 0;
  P.Rw = (rect.wheels[0].circ.r + rect.wheels[1].circ.r) / 2 * sx;
  if (j) fr.RA = { cx: fr.RA.cx + n(0.3), cy: fr.RA.cy + n(0.3) };
  P.FA = [fr.dir * (fr.FA.cx + n(0.3) - fr.RA.cx) * sx, -(fr.FA.cy + n(0.3) - fr.RA.cy) * sy];
  for (const g of GEO) {
    const pt = S.geo[g.k]; if (!pt) continue;
    const sg = g.k === 'bb' ? Math.max(j, j ? 2 : 0) : j; // the BB is never located to a single pixel
    P[g.k] = toBike([pt.p[0] + n(sg), pt.p[1] + n(sg)], pt.depth, rect, tilt, sx, sy, fr);
  }
  for (const k of ['sd', 'mid']) if (S.auto[k]) P[k] = toBike([S.auto[k][0] + n(j), S.auto[k][1] + n(j)], 0, rect, tilt, sx, sy, fr);
  return P;
}
let mcTimer = null;
function scheduleMC() { clearTimeout(mcTimer); mcTimer = setTimeout(() => { runMC(); renderFit(); renderGeo(); }, 120); }
function runMC() {
  S.mc = null;
  if (!S.rect || !S.scale || !S.scale.sx) return;
  const N = 200, o = { W: S.img.W, H: S.img.H, D1: S.D, D2: S.D };
  const sub = S.wheels.map(w => w.pts.filter((_, i) => i % 4 === 0));
  const tilt = S.flatten ? S.tilt : null, diag = Math.hypot(o.W, o.H);
  const base = Core.buildRect(sub[0], sub[1], tilt, o), r0 = base.wheels[0].circ.r + base.wheels[1].circ.r;
  const L = tilt && tilt.cov ? Core.cholesky(tilt.cov) : null, sc = S.scale;
  const sum = {}, sq = {}, cnt = {};
  for (let i = 0; i < N; i++) {
    let t = tilt, rect = S.rect, q = 1;
    if (tilt && L) {
      const z = L.map(() => Core.randn()), d = L.map(row => row.reduce((s, v, k) => s + v * z[k], 0));
      const v = tilt.np === 3 ? Math.max(0, tilt.v + d[2]) : tilt.v;
      t = { a: tilt.a + d[0], b: tilt.b + d[1], v, u: v / diag };
      rect = Core.buildRect(sub[0], sub[1], t, o);
      q = r0 / (rect.wheels[0].circ.r + rect.wheels[1].circ.r);
    }
    const s = (sc.iso.s + sc.iso.sigS * Core.randn()) * q;
    const v = geoValues(geoPoints(rect, t, s, s, S.clickSig));
    for (const k in v) { sum[k] = (sum[k] || 0) + v[k]; sq[k] = (sq[k] || 0) + v[k] * v[k]; cnt[k] = (cnt[k] || 0) + 1; }
  }
  S.mc = {};
  for (const k in sum) { const m = sum[k] / cnt[k]; S.mc[k] = Math.sqrt(Math.max(0, sq[k] / cnt[k] - m * m)); }
}
// ---------- photo grade (provisional thresholds) ----------
function gradePhoto() {
  if (!S.rect || !S.tilt) return null;
  const items = [], t = S.tilt, rank = { good: 0, ok: 1, poor: 2 };
  const add = (level, label, value, advice) => items.push({ level, label, value, advice: level === 'good' ? '' : advice });
  const yaw = Math.atan(t.a) * DEG, pitch = Math.atan(t.b) * DEG, slant = Math.atan(Math.hypot(t.a, t.b)) * DEG;
  const adv = Math.abs(yaw) > Math.abs(pitch) ? 'Stand square to the middle of the bike.' : (pitch > 0 ? 'Lower the camera toward saddle height, or step back and zoom in.' : 'Raise the camera toward saddle height, or step back and zoom in.');
  add(slant < 8 ? 'good' : slant < 20 ? 'ok' : 'poor', 'Camera angle', `${fmt(slant, 1)}° off square`, adv);
  const cov = Math.min(...S.wheels.map(w => Math.min(1, w.coverage))), rms = Math.max(...S.wheels.map(w => w.rms));
  add(cov >= 0.5 && rms < 1 ? 'good' : cov >= 0.3 ? 'ok' : 'poor', 'Tire outlines', `${Math.round(cov * 100)}% traced`, 'Use a plain background that contrasts with the tires.');
  // A turned front wheel makes the front tire, and only the front tire, look narrower than tall after correction.
  // Squash that both tires share (edge finding at the ground, the solve itself) says nothing about steering.
  const oor = S.rect.wheels.map(w => { const e = Core.ellExtents(w.ell); return e.h / e.w - 1; }), ri = rearIdx();
  const diff = Math.abs(oor[1 - ri] - oor[ri]), steer = Math.sqrt(2 * diff) * DEG;
  if (S.flatten) add(diff < 0.003 ? 'good' : diff < 0.008 ? 'ok' : 'poor', 'Front wheel straight', diff < 0.003 ? 'lined up' : `about ${fmt(steer, 0)}° turned`, 'Straighten the front wheel so both wheels line up.');
  if (S.sWork) {
    const mm = S.sWork;
    add(mm < 1 ? 'good' : mm < 2 ? 'ok' : 'poor', 'Resolution', `${fmt(mm, 2)} mm per pixel`, 'Upload the original, full-size photo.');
  }
  const level = items.reduce((m, i) => rank[i.level] > rank[m] ? i.level : m, 'good');
  return { level, items, yaw, pitch, slant };
}

// ---------- view ----------
function ensureFlat() {
  if (!S.rect) return null;
  const key = S.rect.H.map(v => v.toPrecision(9)).join(',');
  if (S.flat && S.flatKey === key) return S.flat;
  const { W, H, rgba } = S.img, Hi = S.rect.Hinv;
  const c = S.flat || document.createElement('canvas'); c.width = W; c.height = H;
  const cx = c.getContext('2d'), out = cx.createImageData(W, H), od = out.data;
  for (let y = 0, o = 0; y < H; y++) {
    let nx = Hi[1] * y + Hi[2], ny = Hi[4] * y + Hi[5], nw = Hi[7] * y + Hi[8];
    for (let x = 0; x < W; x++, o += 4, nx += Hi[0], ny += Hi[3], nw += Hi[6]) {
      const sx = nx / nw, sy = ny / nw;
      if (sx < 0 || sy < 0 || sx > W - 1.001 || sy > H - 1.001) { od[o + 3] = 255; od[o] = od[o + 1] = od[o + 2] = 24; continue; }
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, i = (y0 * W + x0) * 4, j = i + W * 4;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      od[o] = rgba[i] * w00 + rgba[i + 4] * w10 + rgba[j] * w01 + rgba[j + 4] * w11;
      od[o + 1] = rgba[i + 1] * w00 + rgba[i + 5] * w10 + rgba[j + 1] * w01 + rgba[j + 5] * w11;
      od[o + 2] = rgba[i + 2] * w00 + rgba[i + 6] * w10 + rgba[j + 2] * w01 + rgba[j + 6] * w11;
      od[o + 3] = 255;
    }
  }
  cx.putImageData(out, 0, 0);
  S.flat = c; S.flatKey = key;
  return c;
}
const flatView = () => S.view.mode === 'flat' && S.rect;
const toView = p => flatView() ? Core.apply(S.rect.H, p[0], p[1]) : p;
const fromView = p => flatView() ? Core.apply(S.rect.Hinv, p[0], p[1]) : p;
const rect2view = p => flatView() ? p : Core.apply(S.rect.Hinv, p[0], p[1]);
const v2s = p => [(p[0] - S.view.ox) * S.view.z, (p[1] - S.view.oy) * S.view.z];
const i2s = p => v2s(toView(p));
const r2s = p => v2s(rect2view(p));
const s2i = (x, y) => fromView([x / S.view.z + S.view.ox, y / S.view.z + S.view.oy]);
function bike2s(X, Y) { return r2s(bikeToRect([X, Y], bikeFrame(S.rect), S.scale)); }
function fitView() {
  if (!S.img) return;
  const r = cv.getBoundingClientRect();
  const z = Math.min(r.width / S.img.W, r.height / S.img.H) * 0.97;
  S.view.z = z; S.view.ox = S.img.W / 2 - r.width / (2 * z); S.view.oy = S.img.H / 2 - r.height / (2 * z);
  draw();
}
function zoomAt(f, sx, sy) {
  const v = S.view, z1 = Math.min(40, Math.max(0.05, v.z * f));
  v.ox += sx / v.z - sx / z1; v.oy += sy / v.z - sy / z1; v.z = z1; draw();
}
function sizeCanvas() {
  const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d));
  draw();
}

// ---------- drawing ----------
function line(a, b, col, w = 1.5, dash) {
  ctx.save(); ctx.setLineDash(dash || []); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = w + 2; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
}
function tag(x, y, text, col) {
  ctx.save(); ctx.font = '500 12px "IBM Plex Mono", ui-monospace, monospace';
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(12,16,19,.86)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 10, w, 20, 4); ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5); ctx.restore();
}
function lineTag(a, b, text, col) {
  const steep = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
  ctx.save(); ctx.font = '500 12px "IBM Plex Mono", ui-monospace, monospace'; const w = ctx.measureText(text).width / 2 + 14; ctx.restore();
  if (steep) tag(Math.max(a[0], b[0]) + w, (a[1] + b[1]) / 2 + 14, text, col); else tag((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 17, text, col);
}
function dot(p, col, r = 5, label, lx = 0, ly = -19) {
  ctx.save(); ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
  ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.stroke();
  ctx.beginPath(); ctx.arc(p[0], p[1], 1.2, 0, 6.2832); ctx.fillStyle = col; ctx.fill(); ctx.restore();
  if (label) tag(p[0] + lx, p[1] + ly, label, col);
}
function ring(c, r, col, dash) { // circle given in corrected-image coordinates
  ctx.save(); ctx.setLineDash(dash || []); ctx.beginPath();
  for (let a = 0; a <= 360; a += 4) { const p = r2s([c[0] + r * Math.cos(a / DEG), c[1] + r * Math.sin(a / DEG)]); a ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3.5; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
}
function handle(p, set, end) { S.handles.push({ x: p[0], y: p[1], set, end }); }
function draw() {
  const d = window.devicePixelRatio || 1;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  const cw = cv.width / d, ch = cv.height / d;
  ctx.clearRect(0, 0, cw, ch);
  S.handles = [];
  if (!S.img) return;
  const src = flatView() ? ensureFlat() : S.img.canvas, v = S.view;
  ctx.imageSmoothingEnabled = v.z < 3;
  ctx.drawImage(src, -v.ox * v.z, -v.oy * v.z, S.img.W * v.z, S.img.H * v.z);
  const haveScale = S.rect && S.scale && S.scale.sx, R = S.D / 2;

  if (haveScale && S.show.grid) {
    const wb = S.vals ? S.vals.wheelbase : 1000;
    ctx.save(); ctx.strokeStyle = COL.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let X = -500; X <= wb + 500; X += 100) { const a = bike2s(X, -R), b = bike2s(X, 900); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    for (let Y = Math.ceil(-R / 100) * 100; Y <= 900; Y += 100) { const a = bike2s(-500, Y), b = bike2s(wb + 500, Y); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke(); ctx.restore();
  }
  if (haveScale && S.vals) { const wb = S.vals.wheelbase; line(bike2s(-R - 120, -R), bike2s(wb + R + 120, -R), 'rgba(255,255,255,.7)', 1, [6, 5]); }

  // wheels
  S.wheels.forEach((w, k) => {
    if (S.adjust) {
      const c = S.inits[k], pc = i2s([c.cx, c.cy]), pr = i2s([c.cx + c.r, c.cy]), rr = Math.hypot(pr[0] - pc[0], pr[1] - pc[1]);
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = COL.wheel; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pc[0], pc[1], rr, 0, 6.2832); ctx.stroke(); ctx.restore();
      dot(pc, COL.wheel, 6); dot(pr, COL.wheel, 6);
      handle(pc, p => { c.cx = p[0]; c.cy = p[1]; }, () => refit(k));
      handle(pr, p => { c.r = Math.max(10, Math.hypot(p[0] - c.cx, p[1] - c.cy)); }, () => refit(k));
    }
    if (!w || !S.show.wheel) return;
    ctx.save(); ctx.fillStyle = COL.wheel;
    for (const p of w.pts) { const s = i2s(p); ctx.fillRect(s[0] - 1, s[1] - 1, 2, 2); }
    ctx.restore();
    if (S.rect) { const c = S.rect.wheels[k].circ, s = r2s([c.cx, c.cy]); line([s[0] - 7, s[1]], [s[0] + 7, s[1]], COL.wheel, 1.2); line([s[0], s[1] - 7], [s[0], s[1] + 7], COL.wheel, 1.2); }
  });

  if (haveScale) {
    const fr = bikeFrame(S.rect), ra = r2s([fr.RA.cx, fr.RA.cy]), fa = r2s([fr.FA.cx, fr.FA.cy]);
    line(ra, fa, COL.geo, 1.2, [2, 5]);
    const g = k => S.geo[k] ? i2s(S.geo[k].p) : null, sn = g('sn'), sr = g('sr'), bar = g('bar'), ht = g('ht'), hb = g('hb'), st = g('st');
    const bbT = S.sta ? r2s(S.sta.bbR) : null; // BB after the depth correction
    if (S.vals) { const gm = bike2s(S.vals.wheelbase / 2, -R); tag(gm[0], gm[1] + 16, `wheelbase ${fmt(S.vals.wheelbase, 0)} mm`, COL.geo); }
    // crank
    if (S.crank && S.show.crank) ring([S.crank.cx, S.crank.cy], S.crank.r, COL.crank);
    if (S.geo.bb) {
      const ap = i2s(S.geo.bb.p);
      if (S.show.crank) {
        line([ap[0] - 6, ap[1]], [ap[0] + 6, ap[1]], COL.crank, 1.2); line([ap[0], ap[1] - 6], [ap[0], ap[1] + 6], COL.crank, 1.2);
        if (bbT && Math.hypot(bbT[0] - ap[0], bbT[1] - ap[1]) > 3) line(ap, bbT, COL.crank, 1.2, [2, 3]);
      }
      handle(ap, p => { S.geo.bb = { p, depth: S.bbDepth, auto: false }; S.bbMode = 'manual'; });
    }
    // frame lines (only when those points exist)
    if (ht && hb && $('frameDet').open) {
      const dx = hb[0] - ht[0], dy = hb[1] - ht[1], n = Math.hypot(dx, dy) || 1, gy = bike2s(0, -R)[1];
      const tEnd = Math.abs(dy) > 1 ? Math.min(6 * n, Math.max(0, (gy - ht[1]) / (dy / n))) : n;
      line(ht, [ht[0] + dx / n * tEnd, ht[1] + dy / n * tEnd], COL.geo, 1.2, [7, 5]); line(ht, hb, COL.geo, 2);
    }
    // seat tube line and fit
    if (S.sta && S.show.sta && bbT) {
      line(bbT, r2s(S.sta.end), COL.fit, 1.4, [7, 5]);
      const m = r2s([S.sta.bbR[0] + S.sta.u[0] * 260 / S.scale.sx, S.sta.bbR[1] + S.sta.u[1] * 260 / S.scale.sx]);
      tag(m[0] - 52, m[1], `${fmt(S.sta.angle, 1)}° ${S.sta.auto ? 'auto' : S.staMode === 'manual' ? 'manual' : 'default'}`, COL.fit);
    }
    if (sn && sr) line(sn, sr, COL.fit, 1.2);
    const sd = S.auto.sd ? i2s(S.auto.sd) : null, mid = S.auto.mid ? i2s(S.auto.mid) : null;
    if (sd && S.show.sta) dot(sd, COL.fit, 4);
    if (mid) { line([mid[0], mid[1] - 8], [mid[0], mid[1] + 8], COL.fit, 1.8); }
    const ref = S.sadRef === 'nose' ? sn : mid;
    if (ref && bar) {
      const pb = S.geo.bar.p, barR = Core.apply(S.rect.H, pb[0], pb[1]);
      const topR = [barR[0], barR[1] - (S.dropTo === 'top' ? S.barD / 2 / S.scale.sx : 0)], top = r2s(topR);
      const refR = S.sadRef === 'nose' ? Core.apply(S.rect.H, S.geo.sn.p[0], S.geo.sn.p[1]) : Core.apply(S.rect.H, S.auto.mid[0], S.auto.mid[1]);
      const corner = r2s([topR[0], refR[1]]);
      line(ref, bar, COL.fit, 1.2, [2, 5]); line(ref, corner, COL.fit, 1, [3, 4]); line(corner, top, COL.fit, 1.6);
      if (S.vals && S.vals.drop != null) tag(corner[0] + 42, (corner[1] + top[1]) / 2, `${fmt(S.vals.drop, 0)} mm`, COL.fit);
      if (S.vals && S.vals.saddleToBar != null) tag((ref[0] + bar[0]) / 2, (ref[1] + bar[1]) / 2 - 14, `${fmt(S.vals.saddleToBar, 0)} mm`, COL.fit);
    }
    if (bbT) dot(bbT, COL.geo, 6, 'BB', 0, 22);
  }
  const off = { sn: [26, -19], sr: [-26, -19], bar: [0, -19], ht: [-34, -6], hb: [44, 4], st: [-38, 0] };
  for (const gdef of GEO) {
    const pt = S.geo[gdef.k]; if (!pt || gdef.k === 'bb') continue;
    if (gdef.grp === 'frame' && !$('frameDet').open && S.tool !== 'geo:' + gdef.k) continue;
    const s = i2s(pt.p), o = off[gdef.k] || [0, -19];
    dot(s, gdef.grp === 'fit' ? COL.fit : COL.geo, 6, gdef.short, o[0], o[1]);
    handle(s, p => { pt.p = p; });
  }
  S.measures.forEach((m) => {
    const a = i2s(m.p), b = i2s(m.q), val = measureValue(m);
    line(a, b, COL.meas, 1.6); dot(a, COL.meas, 4.5); dot(b, COL.meas, 4.5);
    if (val) lineTag(a, b, `${fmt(val.L, 1)} mm`, COL.meas);
    handle(a, p => { m.p = p; }); handle(b, p => { m.q = p; });
  });
  if (S.pending && S.hover) { const a = i2s(S.pending.p); line(a, S.hover, COL.meas, 1.4, [4, 4]); dot(a, COL.meas, 4.5); }
}
function drawLoupe(sx, sy) {
  if (!S.img) return;
  const src = flatView() ? ensureFlat() : S.img.canvas, v = S.view, zoom = Math.max(6, v.z * 3), n = loupe.width;
  const vx = sx / v.z + v.ox, vy = sy / v.z + v.oy, span = 168 / zoom;
  lctx.imageSmoothingEnabled = false; lctx.fillStyle = '#000'; lctx.fillRect(0, 0, n, n);
  lctx.drawImage(src, vx - span / 2, vy - span / 2, span, span, 0, 0, n, n);
  lctx.strokeStyle = 'rgba(255,255,255,.9)'; lctx.lineWidth = 1;
  lctx.beginPath(); lctx.moveTo(n / 2, 0); lctx.lineTo(n / 2, n / 2 - 12); lctx.moveTo(n / 2, n / 2 + 12); lctx.lineTo(n / 2, n);
  lctx.moveTo(0, n / 2); lctx.lineTo(n / 2 - 12, n / 2); lctx.moveTo(n / 2 + 12, n / 2); lctx.lineTo(n, n / 2); lctx.stroke();
  if (S.rect && S.scale && S.scale.sx) { // scale bar in millimetres
    let mmPerView = S.scale.sx;
    if (!flatView()) { const a = Core.apply(S.rect.H, vx, vy), b = Core.apply(S.rect.H, vx + 1, vy); mmPerView *= Math.hypot(b[0] - a[0], b[1] - a[1]); }
    const pxPerMm = (n / span) / mmPerView, len = [1, 2, 5, 10, 20, 50, 100].find(L => L * pxPerMm >= n * 0.22) || 100, w = len * pxPerMm, x0 = 16, y0 = n - 20;
    lctx.fillStyle = 'rgba(0,0,0,.6)'; lctx.fillRect(x0 - 8, y0 - 34, Math.max(w, 70) + 16, 46);
    lctx.strokeStyle = '#fff'; lctx.lineWidth = 3; lctx.beginPath();
    lctx.moveTo(x0, y0 - 8); lctx.lineTo(x0, y0); lctx.lineTo(x0 + w, y0); lctx.lineTo(x0 + w, y0 - 8);
    if (len >= 10) for (let i = 1; i < len / (len >= 50 ? 10 : len >= 10 ? 5 : 1); i++) { const xx = x0 + w * i / (len / (len >= 50 ? 10 : 5)); lctx.moveTo(xx, y0 - 5); lctx.lineTo(xx, y0); }
    lctx.stroke();
    lctx.fillStyle = '#fff'; lctx.font = '500 22px "IBM Plex Mono", ui-monospace, monospace'; lctx.textBaseline = 'alphabetic'; lctx.fillText(`${len} mm`, x0, y0 - 13);
  }
  loupe.style.display = 'block';
}

// ---------- interaction ----------
function banner(html) { const b = $('banner'); if (html) { b.innerHTML = html; b.style.display = 'block'; } else b.style.display = 'none'; }
function setTool(t, info) {
  S.tool = t; S.pending = null; S.toolInfo = info || null;
  cv.classList.toggle('tool', !!t);
  $('tMeas').setAttribute('aria-pressed', String(t === 'meas'));
  if (!t) { banner(''); loupe.style.display = 'none'; }
  else if (t === 'meas') banner('<b>Measure:</b> click one end, then the other. The length shows on the photo. Esc cancels.');
  else if (t === 'geo:bb') banner(`<b>Bottom bracket:</b> ${S.side === 'drive' ? 'click the center of the chainring.' : 'click the center of the crank axle bolt.'} Scroll to zoom. Esc cancels.`);
  else if (t.startsWith('geo:')) { const g = GEO.find(g => g.k === t.slice(4)); banner(`<b>${esc(g.name)}:</b> ${esc(g.hint)} Scroll to zoom. Esc cancels.`); }
  draw();
}
function refit(k) { const { gray, W, H } = S.img; S.wheels[k] = Core.fitWheel(gray, W, H, S.inits[k]); afterChange(); }
function save() {
  try {
    if (!S.storeKey) return;
    const o = {}; for (const k of ['geo', 'measures', 'bbMode', 'side', 'wb', 'wbTol', 'sh', 'shTol', 'forkOffset', 'useTire', 'D', 'tolD', 'staMode', 'staManual', 'sadRef', 'dropTo', 'barD']) o[k] = S[k];
    localStorage.setItem(S.storeKey, JSON.stringify(o));
  } catch (e) {}
}
function afterChange() { recompute(); renderAll(); draw(); save(); }
function clickAt(sx, sy) {
  const p = s2i(sx, sy);
  if (S.tool === 'meas') {
    if (!S.pending) { S.pending = { p }; draw(); return; }
    S.measures.push({ id: 'm' + (S.uid++), p: S.pending.p, q: p });
    setTool(null); afterChange();
  } else if (S.tool && S.tool.startsWith('geo:')) {
    const k = S.tool.slice(4);
    S.geo[k] = { p, depth: k === 'bb' ? S.bbDepth : 0, auto: false };
    if (k === 'bb') S.bbMode = 'manual';
    const grp = S.toolInfo && S.toolInfo.chain, next = grp ? GEO.find(g => g.grp === grp && !S.geo[g.k]) : null;
    setTool(next ? 'geo:' + next.k : null, next ? { chain: grp } : null);
    afterChange();
  }
}
cv.addEventListener('pointerdown', e => {
  if (!S.img) return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  cv.setPointerCapture(e.pointerId);
  let best = null, bd = 14;
  for (const h of S.handles) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } }
  if (best && !S.tool) S.drag = { h: best, x, y, moved: true };
  else S.drag = { pan: true, x, y, x0: x, y0: y, moved: false };
});
cv.addEventListener('pointermove', e => {
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  S.hover = [x, y];
  const d = S.drag;
  if (d && d.h) { d.h.set(s2i(x, y)); recompute(); draw(); drawLoupe(x, y); renderFit(); }
  else if (d && d.pan) {
    if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > 4) d.moved = true;
    if (d.moved) { S.view.ox -= (x - d.x) / S.view.z; S.view.oy -= (y - d.y) / S.view.z; d.x = x; d.y = y; draw(); }
  } else if (S.tool) { drawLoupe(x, y); if (S.pending) draw(); }
});
cv.addEventListener('pointerup', e => {
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, d = S.drag;
  S.drag = null;
  if (!d) return;
  if (d.h) { loupe.style.display = 'none'; if (d.h.end) d.h.end(); else afterChange(); }
  else if (!d.moved && S.tool) clickAt(x, y);
});
cv.addEventListener('pointerleave', () => { S.hover = null; if (!S.drag) loupe.style.display = 'none'; });
cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && S.tool) setTool(null); });
new ResizeObserver(sizeCanvas).observe($('stage'));

// ---------- side panel ----------
const pill = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;
function renderGrade() {
  if (S.wheels.some(w => !w)) { $('gradeOut').innerHTML = `<div class="grade"><div class="hd"><span class="big poor">Wheels not found</span></div><p class="note warn">Drag each dashed circle onto a tire, then release. It snaps to the tire edge.</p></div>`; $('wheelNote').innerHTML = ''; return; }
  const g = gradePhoto(); if (!g) { $('gradeOut').innerHTML = ''; return; }
  const word = { good: 'Good photo', ok: 'Usable photo', poor: 'Retake advised' }[g.level];
  let h = `<div class="grade"><div class="hd"><span class="big ${g.level}">${word}</span></div><div class="gi">`;
  for (const i of g.items) {
    h += `<span class="d ${i.level}"></span><span>${esc(i.label)}</span><span class="val">${esc(i.value)}</span>`;
    if (i.advice) h += `<span class="adv">${esc(i.advice)}</span>`;
  }
  $('gradeOut').innerHTML = h + '</div></div>';
  $('wheelNote').innerHTML = g.slant >= 1.5 && S.flatten
    ? `<p class="note">The photo has been corrected to square-on. Because the camera was ${fmt(g.slant, 0)}° off, axle ends and other parts that stick out from the wheel look off-center; the axles are taken from the tire outlines instead.</p>` : '';
}

function renderScale() {
  const sc = S.scale;
  if (!S.rect) { $('scaleOut').innerHTML = '<p>Needs both wheels.</p>'; return; }
  if (!sc || !sc.iso) { $('scaleOut').innerHTML = '<p class="note warn">Enter a tire size, a measured wheelbase or your saddle height. Nothing can be measured without one.</p>'; return; }
  const s = sc.sx, pc = v => fmt(v * 100, 2) + '%';
  const rows = [];
  rows.push({ name: 'Tire Ø', on: S.useTire, L: S.useTire ? S.D : null, tol: S.tolD, read: sc.tirePx * s });
  rows.push({ name: 'Wheelbase', on: S.wb > 0, L: S.wb > 0 ? S.wb : null, tol: S.wbTol, read: sc.wbPx * s });
  rows.push({ name: 'Saddle height', on: S.sh > 0 && sc.shPx != null, L: S.sh > 0 ? S.sh : null, tol: S.shTol, read: sc.shPx != null ? sc.shPx * s : (S.vals ? S.vals.saddleHeight : null) });
  let h = `<table class="g"><tr class="hd"><td></td><td class="v">yours</td><td class="v">photo reads</td><td class="e"></td></tr>`;
  for (const r of rows) {
    let st = '';
    if (r.on && sc.used > 1 && r.read != null) {
      const d = r.read - r.L, a = Math.abs(d);
      st = pill(a <= r.tol ? 'good' : a <= 2 * r.tol ? 'ok' : 'poor', `${d >= 0 ? '+' : '−'}${fmt(a, 1)}`);
    } else if (r.on) st = '<span class="note">sets scale</span>';
    h += `<tr><td>${r.name}</td><td class="v">${r.L != null ? fmt(r.L, 1) : '–'}</td><td class="v">${r.read != null ? fmt(r.read, 1) : '–'}</td><td class="e">${st}</td></tr>`;
  }
  h += '</table>';
  h += `<dl class="kv"><dt>Combined scale</dt><dd>${fmt(sc.iso.s, 4)} mm/px ± ${pc(sc.iso.sigS / sc.iso.s)}</dd></dl>`;
  if (sc.used === 1) h += '<p class="note">With one measurement there is nothing to check it against. A tape measure between the axles is the most accurate check.</p>';
  else if (!(S.wb > 0) && !(S.sh > 0)) h += '<p class="note">A tire size alone is good to about ±0.5%. A tape measure between the axles tightens the scale.</p>';
  if (S.sh > 0 && sc.shPx == null) h += '<p class="note">Your saddle height is used once the bottom bracket and saddle are placed (steps 3 to 5).</p>';
  else if (S.sh > 0) h += '<p class="note">Because your saddle height sets part of the scale, the saddle height in the fit results is partly your own number fed back.</p>';
  $('scaleOut').innerHTML = h;
}

function renderBB() {
  let h = '';
  if (!S.scale || !S.scale.sx) h = '<p>Set the scale first.</p>';
  else if (S.bbMode === 'auto' && S.crank) {
    const c = S.crank, s = S.scale.sx;
    h = `<dl class="kv"><dt>Found from the chainring ${pill('good', 'automatic')}</dt><dd>Ø ${fmt(2 * c.r * s, 0)} mm</dd><dt style="padding-left:12px">circle fit</dt><dd><small>${Math.round(Math.min(1, c.coverage) * 100)}% of the circle, ${fmt(c.rms * s, 1)} mm rms</small></dd></dl>`;
    h += '<p class="note">Check that the yellow circle sits on the chainring. If it does not, place the point by hand.</p>';
  } else if (S.bbMode === 'auto') {
    h = `<p class="note warn">${S.side === 'drive' ? 'No clear chainring found.' : 'On the non-drive side there is no chainring to find.'} Place the bottom bracket by hand: ${S.side === 'drive' ? 'click the center of the chainring.' : 'click the crank axle bolt.'}</p>`;
  } else h = `<dl class="kv"><dt>Placed by hand ${pill('ok', 'manual')}</dt><dd>${S.geo.bb ? 'drag the yellow cross to adjust' : 'not placed yet'}</dd></dl>`;
  const g = gradePhoto();
  if (g && S.geo.bb && S.flatten && S.tilt) {
    const a = -S.rect.levelDeg / DEG, tx = Math.cos(a) * S.tilt.a - Math.sin(a) * S.tilt.b, ty = Math.sin(a) * S.tilt.a + Math.cos(a) * S.tilt.b;
    const shift = S.bbDepth * Math.hypot(tx, ty);
    if (g.slant >= 1.5) h += `<p class="note">The camera was ${fmt(g.slant, 0)}° off square, so the bottom bracket is not at the center of the chainring in this photo. It has been corrected for the camera angle, by about ${fmt(shift, 0)} mm here: the white BB mark is the corrected position, the yellow cross the ring center.</p>`;
    else h += '<p class="note">The camera was square to the bike, so the bottom bracket sits at the center of the chainring.</p>';
  }
  if (S.vals && S.vals.chainstay != null) h += `<dl class="kv"><dt>Chainstay</dt><dd>${fmt(S.vals.chainstay, 1)} mm</dd><dt>BB drop</dt><dd>${fmt(S.vals.bbDrop, 1)} mm</dd></dl>`;
  $('bbOut').innerHTML = h;
}

function ptRows(grp) {
  let p = '';
  for (const g of GEO.filter(g => g.grp === grp)) {
    const pt = S.geo[g.k];
    p += `<div class="pt ${pt ? 'set' : ''}"><span class="dot"></span><span class="nm">${esc(g.name)}</span><button class="btn small" data-k="${g.k}">${pt ? 'Redo' : 'Place'}</button></div>`;
  }
  return p;
}
function renderSta() {
  const st = S.sta; let h = '';
  if (!st) h = '<p>Needs the bottom bracket.</p>';
  else if (S.staMode === 'manual') h = `<dl class="kv"><dt>Seat tube angle ${pill('ok', 'manual')}</dt><dd>${fmt(st.angle, 1)}°</dd></dl>`;
  else if (st.auto) h = `<dl class="kv"><dt>Seat tube angle ${pill('good', 'automatic')}</dt><dd>${fmt(st.angle, 1)}°</dd><dt style="padding-left:12px">confidence</dt><dd><small>high: traced along ${fmt(st.det.span, 0)} mm of seatpost and tube</small></dd></dl>`;
  else {
    const why = st.det && st.det.conf === 'low' ? 'The seat tube was traced, but not cleanly enough to trust' : 'The seat tube could not be traced';
    h = `<dl class="kv"><dt>Seat tube angle ${pill('poor', 'default')}</dt><dd>73.5°</dd></dl><p class="note warn">${why}, so the line is set to the default 73.5°. Switch to Manual to set the real angle.</p>`;
  }
  if (st && S.geo.sn && S.geo.sr && S.auto.sd && !S.auto.sdSnap) h += '<p class="note">The saddle outline was not clear along the line, so saddle height is taken to the nose-to-rear line.</p>';
  $('staOut').innerHTML = h;
}

function valRow(k, label, unit, ref) {
  const v = S.vals; if (!v || v[k] == null) return '';
  const ang = unit === '°', e = k === 'seatAngle' ? null : (S.mc && S.mc[k] != null ? S.mc[k] : null);
  let h = `<tr><td>${label}</td><td class="v">${fmt(v[k], ang ? 2 : 1)} ${unit}</td><td class="e">${e == null ? (k === 'seatAngle' ? '' : '…') : fmt(e, ang ? 2 : 1)}</td>`;
  if (ref) { const r = ref[k], d = r == null ? null : v[k] - r, big = d != null && e != null && Math.abs(d) > 2 * Math.max(e, ang ? 0.2 : 1);
    h += `<td class="e">${r == null ? '' : r}</td><td class="e" ${big ? 'style="color:var(--warn)"' : ''}>${d == null ? '' : (d >= 0 ? '+' : '−') + fmt(Math.abs(d), ang ? 2 : 1)}</td>`; }
  return h + '</tr>';
}
function fitRows() {
  const pt = S.sadRef === 'nose' ? 'nose' : 'middle', to = S.dropTo === 'top' ? 'top of bar' : 'bar center';
  return [
    ['sec', 'Practical'],
    ['saddleHeight', S.sh > 0 && S.scale && S.scale.shPx != null ? 'Saddle height (also used for scale)' : 'Saddle height, along the seat tube', 'mm'],
    ['saddleToBar', `Saddle ${pt} to stem clamp center`, 'mm'],
    ['drop', `Drop, saddle ${pt} to ${to}`, 'mm'],
    ['setbackNose', 'Saddle tip behind BB', 'mm'],
    ['sec', 'Coordinates from the BB'],
    ['Sx', `Sx, saddle ${pt} behind BB`, 'mm'], ['Sy', `Sy, saddle ${pt} above BB`, 'mm'],
    ['Hx', 'Hx, stem clamp ahead of BB', 'mm'], ['Hy', 'Hy, stem clamp above BB', 'mm'],
    ['sec', 'Other'], ['saddleLen', 'Saddle length', 'mm'],
  ];
}
function renderFit() {
  $('fitPts').innerHTML = ptRows('fit');
  let h = '';
  if (!S.scale || !S.scale.sx) h = '<p>Set the scale first.</p>';
  else if (!S.geo.bb) h = '<p>Needs the bottom bracket.</p>';
  else {
    let body = '', pend = '';
    for (const r of fitRows()) {
      if (r[0] === 'sec') { pend = `<tr class="sec"><td colspan="3">${r[1]}</td></tr>`; continue; }
      const row = valRow(r[0], r[1], r[2]); if (row) { body += pend + row; pend = ''; }
    }
    h = body ? `<table class="g"><tr class="hd"><td></td><td class="v">value</td><td class="e">±</td></tr>${body}</table>` : '';
    if (GEO.some(g => g.grp === 'fit' && !S.geo[g.k])) h += '<p class="note">Place the saddle nose, saddle rear and stem clamp center to fill this in.</p>';
  }
  $('fitOut').innerHTML = h;
}
function renderGeo() {
  $('ptList').innerHTML = ptRows('frame');
  if (!S.vals) { $('geoOut').innerHTML = '<p>Needs both wheels and a scale.</p>'; return; }
  let body = '';
  for (const [k, label, unit] of ROWS) body += valRow(k, k === 'trail' && S.forkOffset > 0 ? `Trail, with ${fmt(S.forkOffset, 1)} mm offset` : label, unit, S.drawing);
  let h = `<table class="g"><tr class="hd"><td></td><td class="v">value</td><td class="e">±</td>${S.drawing ? '<td class="e">drawing</td><td class="e">diff</td>' : ''}</tr>${body}</table>`;
  if (S.vals.trail != null) h += `<p class="note">Trail uses the tire radius read from the photo (${fmt(S.vals.wheelbase && S.scale ? (S.rect.wheels[0].circ.r + S.rect.wheels[1].circ.r) / 2 * S.scale.sx : null, 1)} mm). Fork offset is hard to read from a photo; enter the spec value if you know it.</p>`;
  if (S.drawing) h += '<p class="note">Drawing column: ETERNA PROD L Drawing v11. A difference is highlighted when it is more than twice the ±.</p>';
  $('geoOut').innerHTML = h;
}

function renderFlatten() {
  const t = S.tilt;
  if (!t || !S.rect) { $('flatOut').innerHTML = '<p>Needs both wheels.</p>'; return; }
  const sd = t.cov ? t.cov.map((r, i) => Math.sqrt(r[i])) : [0, 0, 0];
  const yaw = Math.atan(t.a) * DEG, pitch = Math.atan(t.b) * DEG, yawS = sd[0] / (1 + t.a * t.a) * DEG, pitS = sd[1] / (1 + t.b * t.b) * DEG;
  const side = Math.abs(yaw) < 2 * yawS ? 'square-on' : (yaw < 0 ? 'right end nearer' : 'left end nearer');
  const up = Math.abs(pitch) < 2 * pitS ? 'level' : (pitch < 0 ? 'camera looking up' : 'camera looking down');
  const oor = rect => rect.wheels.map(w => { const e = Core.ellExtents(w.ell); return (e.h / e.w - 1) * 100; });
  const sg = v => (v >= 0 ? '+' : '') + fmt(v, 2) + '%';
  let h = '<dl class="kv">';
  h += `<dt>Sideways angle (yaw)</dt><dd>${fmt(Math.abs(yaw), 1)}° ± ${fmt(yawS, 1)} <small>${side}</small></dd>`;
  h += `<dt>Up/down angle (pitch)</dt><dd>${fmt(Math.abs(pitch), 1)}° ± ${fmt(pitS, 1)} <small>${up}</small></dd>`;
  h += `<dt>Focal length ${t.fixed ? 'used' : 'estimated'}</dt><dd>${isFinite(t.f35) ? fmt(t.f35, 0) + ' mm' : '–'}</dd>`;
  if (S.scale && isFinite(S.scale.Z)) h += `<dt>Camera distance, rough</dt><dd>≈ ${fmt(S.scale.Z / 1000, 0)} m</dd>`;
  h += `<dt>Tires taller than wide, in the photo</dt><dd>${oor(S.rectRaw).map(sg).join('  ')}</dd>`;
  h += `<dt>${S.flatten ? 'after correction' : 'correction is off'}</dt><dd>${oor(S.rect).map(sg).join('  ')}</dd>`;
  h += `<dt>Ground leveled by</dt><dd>${fmt(S.rect.levelDeg, 2)}°</dd></dl>`;
  $('flatOut').innerHTML = h;
}
function measureValue(m) {
  if (!S.rect || !S.scale || !S.scale.sx) return null;
  const P = Core.apply(S.rect.H, m.p[0], m.p[1]), Q = Core.apply(S.rect.H, m.q[0], m.q[1]);
  const dx = (Q[0] - P[0]) * S.scale.sx, dy = -(Q[1] - P[1]) * S.scale.sy, L = Math.hypot(dx, dy), rel = S.scale.iso.sigS / S.scale.iso.s;
  let ang = Math.abs(Math.atan2(dy, dx) * DEG); if (ang > 90) ang = 180 - ang;
  return { L, dx: Math.abs(dx), dy: Math.abs(dy), ang, sig: Math.hypot(L * rel, 1.414 * S.clickSig * S.scale.sx) };
}
function renderAll() {
  renderGrade(); renderScale(); renderBB(); renderSta(); renderFit(); renderGeo(); renderFlatten();
  $('vOrig').setAttribute('aria-pressed', String(S.view.mode !== 'flat')); $('vFlat').setAttribute('aria-pressed', String(S.view.mode === 'flat'));
  $('adjWheels').setAttribute('aria-pressed', String(S.adjust));
  scheduleMC();
}

// ---------- controls ----------
$('exTilted').onclick = () => loadImage(EXAMPLES.tilted.src, EXAMPLES.tilted);
$('exDead').onclick = () => loadImage(EXAMPLES.dead.src, EXAMPLES.dead);
$('file').onchange = e => { const f = e.target.files[0]; if (f) loadImage(f, null); e.target.value = ''; };
document.querySelector('label[for="file"]').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } });
$('stage').addEventListener('dragover', e => e.preventDefault());
$('stage').addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadImage(f, null); });
$('vOrig').onclick = () => { S.view.mode = 'orig'; renderAll(); draw(); };
$('vFlat').onclick = () => { S.view.mode = 'flat'; renderAll(); draw(); };
const center = () => { const r = cv.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };
$('zIn').onclick = () => zoomAt(1.4, ...center());
$('zOut').onclick = () => zoomAt(1 / 1.4, ...center());
$('zFit').onclick = fitView;
for (const [id, k] of [['tWheel', 'wheel'], ['tCrank', 'crank'], ['tSta', 'sta'], ['tGrid', 'grid']])
  $(id).onclick = e => { S.show[k] = !S.show[k]; e.target.setAttribute('aria-pressed', String(S.show[k])); draw(); };
$('side').onchange = e => { S.side = e.target.value; S.bbDepth = depthFor(); S.bbMode = 'auto'; if (S.geo.bb) delete S.geo.bb; afterChange(); };
$('wb').onchange = e => { const v = parseFloat(e.target.value); S.wb = v > 300 ? v : null; afterChange(); };
$('wbTol').onchange = e => { S.wbTol = Math.max(0.1, parseFloat(e.target.value) || 3); afterChange(); };
$('useTire').onchange = e => { S.useTire = e.target.checked; afterChange(); };
$('tirePreset').onchange = e => { const v = parseFloat(e.target.value); if (v) { S.D = v; S.tolD = 3; $('tireD').value = v; $('tireTol').value = 3; afterChange(); } };
$('tireD').onchange = e => { const v = parseFloat(e.target.value); if (v > 100) { S.D = v; $('tirePreset').value = ''; afterChange(); } };
$('tireTol').onchange = e => { S.tolD = Math.max(0.1, parseFloat(e.target.value) || 3); afterChange(); };
$('autoWheels').onclick = () => { if (!S.img) return; findWheels(); afterChange(); };
$('adjWheels').onclick = () => {
  S.adjust = !S.adjust;
  if (S.adjust) { S.wheels.forEach((w, k) => { if (w) S.inits[k] = { cx: w.ell.cx, cy: w.ell.cy, r: (w.ell.a + w.ell.b) / 2 }; }); S.view.mode = 'orig'; }
  renderAll(); draw();
};
$('bbAuto').onclick = () => { S.bbMode = 'auto'; S.crankKey = ''; if (S.geo.bb) delete S.geo.bb; afterChange(); };
$('bbManual').onclick = () => { S.bbMode = 'manual'; renderBB(); setTool('geo:bb'); };
$('staMode').onchange = e => { S.staMode = e.target.value; $('staManual').disabled = S.staMode !== 'manual'; if (S.staMode === 'manual' && S.sta && S.sta.auto) { S.staManual = +S.sta.angle.toFixed(1); $('staManual').value = S.staManual; } afterChange(); };
$('staManual').onchange = e => { const v = parseFloat(e.target.value); if (v > 55 && v < 90) { S.staManual = v; afterChange(); } };
const seg = (a, b, key, va, vb) => { $(a).onclick = () => { S[key] = va; syncInputs(); afterChange(); }; $(b).onclick = () => { S[key] = vb; syncInputs(); afterChange(); }; };
seg('refMid', 'refNose', 'sadRef', 'mid', 'nose'); seg('dropTop', 'dropCen', 'dropTo', 'top', 'center');
$('barD').onchange = e => { const v = parseFloat(e.target.value); if (v > 15) { S.barD = v; afterChange(); } };
$('flattenOn').onchange = e => { S.flatten = e.target.checked; afterChange(); };
$('focalMode').onchange = e => { S.focalMode = e.target.value; $('f35').disabled = S.focalMode !== 'fixed'; if (S.focalMode === 'fixed' && !S.f35) { S.f35 = 50; $('f35').value = 50; } afterChange(); };
$('f35').onchange = e => { const v = parseFloat(e.target.value); if (v >= 10) { S.f35 = v; afterChange(); } };
$('clickSig').onchange = e => { S.clickSig = Math.max(0.1, parseFloat(e.target.value) || 1); afterChange(); };
function startPlace(grp) {
  const list = GEO.filter(g => g.grp === grp);
  if (list.every(g => S.geo[g.k])) for (const g of list) delete S.geo[g.k];
  const next = list.find(g => !S.geo[g.k]);
  recompute(); renderAll(); setTool('geo:' + next.k, { chain: grp });
}
$('placeAll').onclick = () => { $('frameDet').open = true; startPlace('frame'); };
$('placeFit').onclick = () => startPlace('fit');
for (const id of ['ptList', 'fitPts']) $(id).addEventListener('click', e => { const k = e.target.dataset.k; if (k) setTool('geo:' + k); });
$('tMeas').onclick = () => setTool(S.tool === 'meas' ? null : 'meas');
$('tClear').onclick = () => { S.measures = []; if (S.tool === 'meas') setTool(null); afterChange(); };
$('sh').onchange = e => { const v = parseFloat(e.target.value); S.sh = v > 300 ? v : null; afterChange(); };
$('shTol').onchange = e => { S.shTol = Math.max(0.1, parseFloat(e.target.value) || 3); afterChange(); };
$('forkOff').onchange = e => { const v = parseFloat(e.target.value); S.forkOffset = v > 0 ? v : null; afterChange(); };
$('resetPts').onclick = () => { try { localStorage.removeItem(S.storeKey); } catch (e) {} if (S.preset) loadImage(S.preset.src, S.preset); else { S.geo = {}; S.measures = []; S.bbMode = 'auto'; afterChange(); } };
const flash = t => { $('copyMsg').textContent = t; setTimeout(() => { $('copyMsg').textContent = ''; }, 2500); };
$('copyGeo').onclick = async () => {
  if (!S.vals) return;
  const rows = fitRows().filter(r => r[0] !== 'sec').concat(ROWS).filter(r => S.vals[r[0]] != null);
  const lines = rows.map(([k, label, unit]) => `${label}\t${fmt(S.vals[k], unit === '°' ? 2 : 1)}\t${unit}\t±${S.mc && S.mc[k] != null ? fmt(S.mc[k], unit === '°' ? 2 : 1) : ''}`);
  if (S.sta) lines.unshift(`Seat tube angle (${S.sta.auto ? 'automatic' : 'manual'})\t${fmt(S.sta.angle, 1)}\t°\t`);
  try { await navigator.clipboard.writeText(lines.join('\n')); flash('Copied.'); } catch (err) { flash('Copy was blocked here.'); }
};
$('copyPts').onclick = async () => {
  const o = { side: S.side, wheelbase: S.wb, tireD: S.D, bbMode: S.bbMode, geo: {} };
  for (const k in S.geo) o.geo[k] = S.geo[k].p.map(v => +v.toFixed(1));
  try { await navigator.clipboard.writeText(JSON.stringify(o)); flash('Points copied.'); } catch (err) { flash('Copy was blocked here.'); }
};

$('frameDet').addEventListener('toggle', draw);
sizeCanvas();
loadImage(EXAMPLES.tilted.src, EXAMPLES.tilted);

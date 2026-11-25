// Rim lip detector, NOT wired into the app (see HANDOFF.md, "Open decisions" 1).
// Includes both fixes: outermost highlight, and only directions where camera tilt can't widen the lip.
// fg: grayscale of the corrected (flattened) photo; c: tire circle {cx, cy, r} in corrected pixels;
// tiltDir: direction of camera tilt in the corrected photo (radians), or null when the camera is square.
function detectRimLip(fg, W, H, c, tiltDir, bilinear, median) {
  const f0 = 0.88, f1 = 0.97, df = 0.0005, band = Math.sin(30 * Math.PI / 180), lip = [];
  for (let a = 0; a < 360; a += 1) {
    const t = a * Math.PI / 180;
    if (tiltDir != null && Math.abs(Math.cos(t - tiltDir)) >= band) continue;
    const prof = [];
    for (let f = f0; f <= f1 + 1e-9; f += df) prof.push(bilinear(fg, W, H, c.cx + f * c.r * Math.cos(t), c.cy + f * c.r * Math.sin(t)));
    const md = prof.slice().sort((x, y) => x - y)[prof.length >> 1];
    let pick = -1; // outermost local maximum at least 15 above the profile median
    for (let k = 3; k < prof.length - 3; k++) if (prof[k] >= prof[k - 1] && prof[k] >= prof[k + 1] && prof[k] - md >= 15) pick = k;
    if (pick >= 0) lip.push(f0 + pick * df);
  }
  if (lip.length < 40) return null;
  // mode, not median: take the densest cluster of ratios
  let bm = lip[0], bc = 0;
  for (const x of lip) { const n = lip.filter(y => Math.abs(y - x) < 0.003).length; if (n > bc) { bc = n; bm = x; } }
  const near = lip.filter(y => Math.abs(y - bm) < 0.004), ratio = median(near);
  return { ratio, share: near.length / lip.length, n: near.length }; // rim lip Ø in px = 2 * c.r * ratio
}
// Use only when front and rear ratios agree to within about 0.006.
// tiltDir in the app: rotate (tilt.a, tilt.b) by -rect.levelDeg, then atan2(ty, tx).
if (typeof module !== 'undefined') module.exports = { detectRimLip };

/* Core math for the bike photo measuring tool. Pure functions, no DOM. */
const Core = (() => {
  'use strict';

  // ---------- small linear algebra ----------
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-300) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function inverse(A) {
    const n = A.length, cols = [];
    for (let j = 0; j < n; j++) {
      const e = new Array(n).fill(0); e[j] = 1;
      const x = solve(A.map(r => r.slice()), e);
      if (!x) return null;
      cols.push(x);
    }
    return A.map((_, i) => cols.map(c => c[i]));
  }
  // weighted least squares: rows [coeffs], y, sigma. Returns {x, cov}
  function wls(rows, y, sig) {
    const n = rows[0].length;
    const N = Array.from({ length: n }, () => new Array(n).fill(0)), g = new Array(n).fill(0);
    for (let i = 0; i < rows.length; i++) {
      const w = 1 / (sig[i] * sig[i]);
      for (let a = 0; a < n; a++) {
        g[a] += w * rows[i][a] * y[i];
        for (let b = 0; b < n; b++) N[a][b] += w * rows[i][a] * rows[i][b];
      }
    }
    const cov = inverse(N);
    if (!cov) return null;
    return { x: cov.map(r => r.reduce((s, v, j) => s + v * g[j], 0)), cov };
  }
  const mul3 = (A, B) => {
    const C = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return C;
  };
  function inv3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [A / det, (c * h - b * i) / det, (b * f - c * e) / det,
            B / det, (a * i - c * g) / det, (c * d - a * f) / det,
            C / det, (b * g - a * h) / det, (a * e - b * d) / det];
  }
  const apply = (H, x, y) => {
    const w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  };
  const T = (tx, ty) => [1, 0, tx, 0, 1, ty, 0, 0, 1];
  const median = arr => {
    if (!arr.length) return 0;
    const s = Float64Array.from(arr).sort(), m = s.length >> 1;
    return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
  };
  // gaussian random
  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function cholesky(A) {
    const n = A.length, L = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 0)) : (L[j][j] > 0 ? s / L[j][j] : 0);
    }
    return L;
  }

  // ---------- image ----------
  function toGray(rgba, w, h) {
    const g = new Float32Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4)
      g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    return g;
  }
  function bilinear(g, w, h, x, y) {
    if (x < 0) x = 0; else if (x > w - 1.001) x = w - 1.001;
    if (y < 0) y = 0; else if (y > h - 1.001) y = h - 1.001;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
  }

  // ---------- wheel auto-detect: gradient-voted Hough for dark discs ----------
  function detectWheels(gray, w, h) {
    const sc = 360 / Math.max(w, h), sw = Math.round(w * sc), sh = Math.round(h * sc);
    const sm = new Float32Array(sw * sh), cnt = new Uint16Array(sw * sh);
    for (let y = 0; y < h; y++) {
      const yy = Math.min(sh - 1, (y * sc) | 0);
      for (let x = 0; x < w; x++) {
        const k = yy * sw + Math.min(sw - 1, (x * sc) | 0);
        sm[k] += gray[y * w + x]; cnt[k]++;
      }
    }
    for (let i = 0; i < sm.length; i++) sm[i] /= cnt[i] || 1;
    const gx = new Float32Array(sw * sh), gy = new Float32Array(sw * sh), mag = new Float32Array(sw * sh);
    for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      gx[i] = (sm[i - sw + 1] + 2 * sm[i + 1] + sm[i + sw + 1]) - (sm[i - sw - 1] + 2 * sm[i - 1] + sm[i + sw - 1]);
      gy[i] = (sm[i + sw - 1] + 2 * sm[i + sw] + sm[i + sw + 1]) - (sm[i - sw - 1] + 2 * sm[i - sw] + sm[i - sw + 1]);
      mag[i] = Math.hypot(gx[i], gy[i]);
    }
    const sorted = Float32Array.from(mag).sort();
    const thr = sorted[Math.floor(sorted.length * 0.85)];
    const rMin = Math.max(8, Math.round(0.04 * sw)), rMax = Math.round(Math.min(0.24 * sw, 0.5 * sh));
    const nr = rMax - rMin + 1, cw = Math.ceil(sw / 2), ch = Math.ceil(sh / 2);
    const acc = new Uint16Array(cw * ch * nr);
    for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      if (mag[i] < thr) continue;
      const ux = gx[i] / mag[i], uy = gy[i] / mag[i];
      for (let r = rMin; r <= rMax; r++) {
        const cx = (x - r * ux) / 2, cy = (y - r * uy) / 2; // centre lies on the dark side
        if (cx < 0 || cy < 0 || cx >= cw || cy >= ch) continue;
        acc[((r - rMin) * ch + (cy | 0)) * cw + (cx | 0)]++;
      }
    }
    const score = (ri, cy, cx) => {
      let s = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const r = ri + dr, y = cy + dy, x = cx + dx;
        if (r < 0 || r >= nr || y < 0 || y >= ch || x < 0 || x >= cw) continue;
        s += acc[(r * ch + y) * cw + x];
      }
      return s / (ri + rMin);
    };
    const cands = [];
    for (let ri = 0; ri < nr; ri++) for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      if (acc[(ri * ch + cy) * cw + cx] < 3) continue;
      cands.push([score(ri, cy, cx), ri, cy, cx]);
    }
    cands.sort((a, b) => b[0] - a[0]);
    const peaks = [];
    for (const c of cands) {
      const r = c[1] + rMin, x = c[3] * 2 + 1, y = c[2] * 2 + 1;
      if (peaks.some(p => Math.hypot(p.x - x, p.y - y) < 0.6 * Math.max(p.r, r))) continue;
      peaks.push({ x, y, r, s: c[0] });
      if (peaks.length >= 14) break;
    }
    let best = null;
    for (let i = 0; i < peaks.length; i++) for (let j = i + 1; j < peaks.length; j++) {
      const p = peaks[i], q = peaks[j], r = Math.max(p.r, q.r), d = Math.hypot(p.x - q.x, p.y - q.y);
      if (Math.abs(p.r - q.r) > 0.15 * r || d < 2.3 * r || d > 4.4 * r || Math.abs(p.y - q.y) > 0.6 * r) continue;
      const s = p.s + q.s;
      if (!best || s > best.s) best = { s, pair: p.x < q.x ? [p, q] : [q, p] };
    }
    if (!best) return null;
    return best.pair.map(p => ({ cx: p.x / sc, cy: p.y / sc, r: p.r / sc }));
  }

  // ---------- ellipse fit ----------
  // conic with A + C = 1 (well behaved for near-circles); pts normalised internally
  function fitEllipse(pts) {
    let mx = 0, my = 0;
    for (const p of pts) { mx += p[0]; my += p[1]; }
    mx /= pts.length; my /= pts.length;
    let sc = 0;
    for (const p of pts) sc += Math.hypot(p[0] - mx, p[1] - my);
    sc /= pts.length;
    const N = Array.from({ length: 5 }, () => new Array(5).fill(0)), g = new Array(5).fill(0);
    for (const p of pts) {
      const x = (p[0] - mx) / sc, y = (p[1] - my) / sc;
      const row = [x * x - y * y, x * y, x, y, 1], rhs = -y * y;
      for (let a = 0; a < 5; a++) { g[a] += row[a] * rhs; for (let b = 0; b < 5; b++) N[a][b] += row[a] * row[b]; }
    }
    const s = solve(N, g);
    if (!s) return null;
    const A = s[0], B = s[1], C = 1 - s[0], D = s[2], E = s[3], F = s[4];
    const c = solve([[2 * A, B], [B, 2 * C]], [-D, -E]);
    if (!c) return null;
    const Fc = A * c[0] * c[0] + B * c[0] * c[1] + C * c[1] * c[1] + D * c[0] + E * c[1] + F;
    const tr = A + C, df = Math.hypot(A - C, B);
    const l1 = (tr - df) / 2, l2 = (tr + df) / 2; // l1 <= l2
    if (l1 <= 0 || -Fc <= 0) return null;
    const a = Math.sqrt(-Fc / l1), b = Math.sqrt(-Fc / l2);
    const phi = 0.5 * Math.atan2(-B, C - A); // direction of major axis
    return { cx: mx + sc * c[0], cy: my + sc * c[1], a: a * sc, b: b * sc, phi };
  }
  // radius of ellipse along direction theta from its centre
  function ellRadius(e, th) {
    const c = Math.cos(th - e.phi), s = Math.sin(th - e.phi);
    return e.a * e.b / Math.sqrt(e.b * e.b * c * c + e.a * e.a * s * s);
  }
  // approx signed distance from point to ellipse (first order)
  function ellDist(e, x, y) {
    const c = Math.cos(e.phi), s = Math.sin(e.phi);
    const u = (x - e.cx) * c + (y - e.cy) * s, v = -(x - e.cx) * s + (y - e.cy) * c;
    const f = u * u / (e.a * e.a) + v * v / (e.b * e.b) - 1;
    const gn = 2 * Math.hypot(u / (e.a * e.a), v / (e.b * e.b));
    return gn > 0 ? f / gn : 0;
  }
  // extent of ellipse along x and along y
  function ellExtents(e) {
    const c = Math.cos(e.phi), s = Math.sin(e.phi);
    return { w: 2 * Math.sqrt(e.a * e.a * c * c + e.b * e.b * s * s), h: 2 * Math.sqrt(e.a * e.a * s * s + e.b * e.b * c * c) };
  }

  // ---------- tire-edge tracing ----------
  // radial rays from a centre; finds the outermost strong dark->light step near the expected radius
  function traceRays(gray, w, h, cx, cy, radiusAt, win, nRays) {
    const out = [];
    for (let i = 0; i < nRays; i++) {
      const th = 2 * Math.PI * i / nRays, dx = Math.cos(th), dy = Math.sin(th);
      const r0 = radiusAt(th), half = win(r0), step = 0.5;
      const n = Math.max(8, Math.round(2 * half / step));
      const sig = Math.max(1.2, r0 / 180) / step; // smoothing in samples
      const prof = new Float32Array(n);
      let inside = true;
      for (let k = 0; k < n; k++) {
        const r = r0 - half + k * step, x = cx + r * dx, y = cy + r * dy;
        if (x < 1 || y < 1 || x > w - 2 || y > h - 2) { inside = false; break; }
        prof[k] = bilinear(gray, w, h, x, y);
      }
      if (!inside) continue;
      const kr = Math.ceil(2.5 * sig), d = new Float32Array(n);
      for (let k = kr; k < n - kr; k++) { // derivative-of-gaussian
        let s = 0;
        for (let j = -kr; j <= kr; j++) s += -j * Math.exp(-j * j / (2 * sig * sig)) * prof[k + j];
        d[k] = -s / (sig * sig * sig * 2.5066);
      }
      let mx = 0;
      for (let k = kr; k < n - kr; k++) if (d[k] > mx) mx = d[k];
      if (mx <= 0) continue;
      let best = -1;
      for (let k = n - kr - 2; k > kr; k--) if (d[k] >= 0.6 * mx && d[k] >= d[k - 1] && d[k] >= d[k + 1]) { best = k; break; }
      if (best < 0) continue;
      const den = d[best - 1] - 2 * d[best] + d[best + 1];
      const off = den < 0 ? 0.5 * (d[best - 1] - d[best + 1]) / den : 0;
      const r = r0 - half + (best + off) * step;
      out.push({ x: cx + r * dx, y: cy + r * dy, r, th, str: d[best] });
    }
    return out;
  }
  function fitWheel(gray, w, h, init) {
    // pass 1: wide search around the starting circle
    let pts = traceRays(gray, w, h, init.cx, init.cy, () => init.r, r => 0.13 * r, 360);
    if (pts.length < 40) return null;
    const strMed = median(pts.map(p => p.str));
    pts = pts.filter(p => p.str > 0.3 * strMed);
    const rMed = median(pts.map(p => p.r));
    const mad0 = 1.4826 * median(pts.map(p => Math.abs(p.r - rMed)));
    let keep = pts.filter(p => Math.abs(p.r - rMed) < Math.max(3 * mad0, 0.012 * init.r));
    let ell = null;
    const robust = (all) => {
      let k = keep, e = null;
      for (let it = 0; it < 6; it++) {
        if (k.length < 20) return null;
        e = fitEllipse(k.map(p => [p.x, p.y]));
        if (!e) return null;
        const res = all.map(p => ellDist(e, p.x, p.y));
        const s = 1.4826 * median(k.map(p => Math.abs(ellDist(e, p.x, p.y))));
        const thr = Math.max(2.5 * s, 0.35);
        k = all.filter((p, i) => Math.abs(res[i]) < thr);
      }
      keep = k;
      return e;
    };
    ell = robust(pts);
    if (!ell) return null;
    // pass 2: narrow search along the fitted outline
    for (let pass = 0; pass < 2; pass++) {
      const e0 = ell;
      let p2 = traceRays(gray, w, h, e0.cx, e0.cy, th => ellRadius(e0, th), r => Math.max(5, 0.03 * r), 480);
      if (p2.length < 60) break;
      const sm = median(p2.map(p => p.str));
      p2 = p2.filter(p => p.str > 0.3 * sm);
      keep = p2.filter(p => Math.abs(ellDist(e0, p.x, p.y)) < Math.max(3, 0.006 * e0.a));
      const e1 = robust(p2);
      if (!e1) break;
      ell = e1;
    }
    let ss = 0;
    for (const p of keep) { const d = ellDist(ell, p.x, p.y); ss += d * d; }
    return { ell, pts: keep.map(p => [p.x, p.y]), rms: Math.sqrt(ss / keep.length), coverage: keep.length / 480 };
  }

  // ---------- circle fits ----------
  function kasa(pts) {
    let mx = 0, my = 0;
    for (const p of pts) { mx += p[0]; my += p[1]; }
    mx /= pts.length; my /= pts.length;
    let Suu = 0, Suv = 0, Svv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
    for (const p of pts) {
      const u = p[0] - mx, v = p[1] - my;
      Suu += u * u; Suv += u * v; Svv += v * v; Suuu += u * u * u; Svvv += v * v * v; Suvv += u * v * v; Svuu += v * u * u;
    }
    const c = solve([[Suu, Suv], [Suv, Svv]], [0.5 * (Suuu + Suvv), 0.5 * (Svvv + Svuu)]);
    if (!c) return null;
    return { cx: c[0] + mx, cy: c[1] + my, r: Math.sqrt(c[0] * c[0] + c[1] * c[1] + (Suu + Svv) / pts.length) };
  }
  // two circles whose radii are rho*D1 and rho*D2. Returns centres, rho and residuals
  function fitTwoCircles(P1, P2, D1, D2) {
    const k1 = kasa(P1), k2 = kasa(P2);
    if (!k1 || !k2) return null;
    let q = [k1.cx, k1.cy, k2.cx, k2.cy, 0.5 * (k1.r / D1 + k2.r / D2)];
    const sets = [[P1, D1, 0], [P2, D2, 2]];
    let res = null;
    for (let it = 0; it < 5; it++) {
      const N = Array.from({ length: 5 }, () => new Array(5).fill(0)), g = new Array(5).fill(0);
      res = [];
      for (const [P, D, o] of sets) for (const p of P) {
        const dx = p[0] - q[o], dy = p[1] - q[o + 1], d = Math.hypot(dx, dy) || 1e-9, e = d - q[4] * D;
        res.push(e);
        const J = [0, 0, 0, 0, -D]; J[o] = -dx / d; J[o + 1] = -dy / d;
        for (let a = 0; a < 5; a++) { if (!J[a]) continue; g[a] -= J[a] * e; for (let b = 0; b < 5; b++) N[a][b] += J[a] * J[b]; }
      }
      if (it === 4) break;
      const dq = solve(N, g);
      if (!dq) break;
      for (let a = 0; a < 5; a++) q[a] += dq[a];
    }
    return { c1: [q[0], q[1]], c2: [q[2], q[3]], rho: q[4], res };
  }

  // ---------- flatten model ----------
  // Homography that undoes a tilt of the bike plane relative to the sensor.
  // t = (a,b) = tan(slant) * direction; u = 1/focal length in px. Regular at u=0 (pure foreshortening).
  function tiltH(a, b, u, pcx, pcy) {
    const t2 = a * a + b * b;
    const k = t2 > 1e-14 ? (Math.sqrt(1 + t2) - 1) / t2 : 0.5;
    const H = [1 + k * a * a, k * a * b, 0, k * a * b, 1 + k * b * b, 0, -u * a, -u * b, 1];
    return mul3(T(pcx, pcy), mul3(H, T(-pcx, -pcy)));
  }
  const mapPts = (H, P) => P.map(p => apply(H, p[0], p[1]));

  // Solve tilt from the two tire outlines. opts: {W,H,D1,D2,f35 (number|null = estimate)}
  function solveTilt(P1, P2, opts) {
    const { W, H: Hh, D1, D2 } = opts, diag = Math.hypot(W, Hh), pcx = W / 2, pcy = Hh / 2;
    const fixV = opts.f35 ? 43.27 / opts.f35 : null;
    const vMax = 43.27 / 16;
    // when the focal length is estimated, a weak prior keeps it sane if the photo carries no perspective signal
    const v0 = opts.f35Prior ? 43.27 / opts.f35Prior : 0.5, priorW = 0.35 / (opts.f35Prior ? 0.3 * v0 : 0.5);
    const resid = (p) => {
      const v = fixV != null ? fixV : p[2];
      const Hm = tiltH(p[0], p[1], v / diag, pcx, pcy);
      const f = fitTwoCircles(mapPts(Hm, P1), mapPts(Hm, P2), D1, D2);
      if (!f) return null;
      if (fixV == null) f.res.push(priorW * (v - v0));
      return f.res;
    };
    const np = fixV != null ? 2 : 3;
    const cost = r => r.reduce((s, v) => s + v * v, 0);
    const jac = (p, r0) => {
      const hs = [1e-4, 1e-4, 2e-3], J = [];
      for (let k = 0; k < np; k++) {
        const q = p.slice(); q[k] += hs[k];
        const r1 = resid(q);
        J.push(r1.map((v, i) => (v - r0[i]) / hs[k]));
      }
      return J;
    };
    const run = (p) => {
      let r = resid(p); if (!r) return null;
      let c = cost(r), lam = 1e-3;
      for (let it = 0; it < 40; it++) {
        const J = jac(p, r);
        const N = Array.from({ length: np }, (_, a) => Array.from({ length: np }, (_, b) => J[a].reduce((s, v, i) => s + v * J[b][i], 0)));
        const g = J.map(Ja => -Ja.reduce((s, v, i) => s + v * r[i], 0));
        let improved = false;
        for (let tries = 0; tries < 8; tries++) {
          const Nd = N.map((row, a) => row.map((v, b) => a === b ? v * (1 + lam) + 1e-12 : v));
          const dp = solve(Nd, g);
          if (!dp) { lam *= 10; continue; }
          const q = p.map((v, k) => v + dp[k]);
          if (np === 3) q[2] = Math.min(vMax, Math.max(0, q[2]));
          const r1 = resid(q);
          if (r1 && cost(r1) < c) {
            const done = (c - cost(r1)) < 1e-10 * c;
            p = q; r = r1; c = cost(r1); lam = Math.max(lam / 5, 1e-9); improved = true;
            if (done) it = 99;
            break;
          }
          lam *= 10;
        }
        if (!improved) break;
      }
      return { p, r, c };
    };
    const starts = np === 3 ? [[0, 0, v0], [0, 0, Math.min(vMax, 2.5 * v0)]] : [[0, 0]];
    let best = null;
    for (const s of starts) {
      const a = run(s.slice());
      if (a && (!best || a.c < best.c)) best = a;
      if (a) { // mirrored solution (same foreshortening, opposite perspective)
        const m = a.p.slice(); m[0] = -m[0]; m[1] = -m[1];
        const bb = run(m);
        if (bb && bb.c < best.c) best = bb;
      }
    }
    if (!best) return null;
    const n = best.r.length, dof = Math.max(1, n - np - 5);
    const J = jac(best.p, best.r);
    const N = Array.from({ length: np }, (_, a) => Array.from({ length: np }, (_, b) => J[a].reduce((s, v, i) => s + v * J[b][i], 0)));
    // edge errors are correlated along the tire, so inflate the formal covariance (x3 on sigma)
    const INFL = 9;
    let cov = inverse(N.map((row, a) => row.map((v, b) => a === b ? v + 1e-9 : v)));
    const s2 = best.c / dof;
    cov = cov ? cov.map(row => row.map(v => v * s2 * INFL)) : null;
    const v = fixV != null ? fixV : best.p[2];
    return {
      a: best.p[0], b: best.p[1], v, u: v / diag, f35: v > 1e-6 ? 43.27 / v : Infinity,
      rms: Math.sqrt(best.c / n), cov, np, fixed: fixV != null,
      sigV: (fixV == null && cov) ? Math.sqrt(cov[2][2]) : 0
    };
  }

  // Full rectification = tilt removal, then level the ground, keeping overall size and position.
  // tilt may be null (no flatten: similarity only).
  function buildRect(P1, P2, tilt, opts) {
    const { W, H: Hh, D1, D2 } = opts;
    const Ht = tilt ? tiltH(tilt.a, tilt.b, tilt.u, W / 2, Hh / 2) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const Q1 = mapPts(Ht, P1), Q2 = mapPts(Ht, P2);
    const k1 = kasa(Q1), k2 = kasa(Q2);
    const o1 = kasa(P1), o2 = kasa(P2);
    const dx = k2.cx - k1.cx, dy = k2.cy - k1.cy, d = Math.hypot(dx, dy);
    // if tires differ, the axle line is not parallel to the ground
    const pxPerMm = 0.5 * (k1.r / (D1 / 2) + k2.r / (D2 / 2));
    const slope = Math.asin(Math.max(-1, Math.min(1, ((D2 - D1) / 2) * pxPerMm / d)));
    const flip = dx < 0 ? Math.PI : 0;
    const ang = Math.atan2(dy, dx) + slope - flip; // rotate by -ang to level (image y is down)
    const sc = Math.hypot(o2.cx - o1.cx, o2.cy - o1.cy) / d;
    const c = Math.cos(-ang) * sc, s = Math.sin(-ang) * sc;
    const mx = (k1.cx + k2.cx) / 2, my = (k1.cy + k2.cy) / 2, ox = (o1.cx + o2.cx) / 2, oy = (o1.cy + o2.cy) / 2;
    const S = mul3(T(ox, oy), mul3([c, -s, 0, s, c, 0, 0, 0, 1], T(-mx, -my)));
    const Hf = mul3(S, Ht);
    const R1 = mapPts(Hf, P1), R2 = mapPts(Hf, P2);
    return { H: Hf, Hinv: inv3(Hf), wheels: [{ circ: kasa(R1), ell: fitEllipse(R1) }, { circ: kasa(R2), ell: fitEllipse(R2) }], levelDeg: ang * 180 / Math.PI };
  }

  // ---------- scale from references ----------
  // refs: [{px, theta (rad, 0=horizontal), L (mm), tol (mm), sigPx, group}]
  // model: L/px = s + e*cos(2 theta); nominal lengths in one group share one relative error
  function fitScale(refs, withAniso) {
    if (!refs.length) return null;
    const groups = [...new Set(refs.map(r => r.group))];
    const y = refs.map(r => r.L / r.px);
    let s0 = 0, w0 = 0;
    refs.forEach((r, i) => { const wt = r.px; s0 += wt * y[i]; w0 += wt; });
    s0 /= w0;
    const base = withAniso ? 2 : 1, n = base + groups.length;
    const rows = [], yy = [], sig = [];
    refs.forEach((r, i) => {
      const row = new Array(n).fill(0);
      row[0] = 1; if (withAniso) row[1] = Math.cos(2 * r.theta);
      row[base + groups.indexOf(r.group)] = -s0;
      rows.push(row); yy.push(y[i]); sig.push(Math.max(1e-9, y[i] * r.sigPx / r.px));
    });
    groups.forEach((gname, gi) => {
      const members = refs.filter(r => r.group === gname);
      const rel = Math.max(1e-6, Math.max(...members.map(r => r.tol / r.L)));
      const row = new Array(n).fill(0); row[base + gi] = 1;
      rows.push(row); yy.push(0); sig.push(rel);
    });
    const f = wls(rows, yy, sig);
    if (!f) return null;
    const s = f.x[0], e = withAniso ? f.x[1] : 0;
    const out = { s, e, sx: s + e, sy: s - e, cov: f.cov, aniso: withAniso ? 2 * e / s : 0 };
    out.sigS = Math.sqrt(f.cov[0][0]);
    if (withAniso) {
      out.sigE = Math.sqrt(f.cov[1][1]);
      out.sigSx = Math.sqrt(Math.max(0, f.cov[0][0] + f.cov[1][1] + 2 * f.cov[0][1]));
      out.sigSy = Math.sqrt(Math.max(0, f.cov[0][0] + f.cov[1][1] - 2 * f.cov[0][1]));
      out.sigAniso = 2 * out.sigE / s;
    }
    return out;
  }

  // ---------- EXIF focal length ----------
  function exifFocal(buf) {
    try {
      const dv = new DataView(buf);
      if (dv.getUint16(0) !== 0xFFD8) return null;
      let o = 2;
      while (o + 4 < dv.byteLength) {
        const marker = dv.getUint16(o), len = dv.getUint16(o + 2);
        if (marker === 0xFFE1 && dv.getUint32(o + 4) === 0x45786966) {
          const t = o + 10, le = dv.getUint16(t) === 0x4949;
          const u16 = p => dv.getUint16(p, le), u32 = p => dv.getUint32(p, le);
          const readIFD = (off, want) => {
            const res = {}, n = u16(t + off);
            for (let i = 0; i < n; i++) {
              const e = t + off + 2 + i * 12, tag = u16(e);
              if (want.includes(tag)) res[tag] = { type: u16(e + 2), valOff: e + 8 };
            }
            return res;
          };
          const ifd0 = readIFD(u32(t + 4), [0x8769]);
          if (!ifd0[0x8769]) return null;
          const ex = readIFD(u32(ifd0[0x8769].valOff), [0x920A, 0xA405]);
          const out = {};
          if (ex[0x920A]) { const p = t + u32(ex[0x920A].valOff); out.focal = u32(p) / (u32(p + 4) || 1); }
          if (ex[0xA405]) out.focal35 = u16(ex[0xA405].valOff);
          return out.focal || out.focal35 ? out : null;
        }
        if ((marker & 0xFF00) !== 0xFF00) break;
        o += 2 + len;
      }
    } catch (e) { /* no usable EXIF */ }
    return null;
  }


  // ---------- v2: detectors that work in the flattened image ----------
  function warpGray(gray, W, H, Hi) {
    const out = new Float32Array(W * H);
    for (let y = 0, o = 0; y < H; y++) {
      let nx = Hi[1] * y + Hi[2], ny = Hi[4] * y + Hi[5], nw = Hi[7] * y + Hi[8];
      for (let x = 0; x < W; x++, o++, nx += Hi[0], ny += Hi[3], nw += Hi[6]) {
        const sx = nx / nw, sy = ny / nw;
        out[o] = (sx < 0 || sy < 0 || sx > W - 1.001 || sy > H - 1.001) ? 128 : bilinear(gray, W, H, sx, sy);
      }
    }
    return out;
  }
  // Chainring as a circle near where a bottom bracket can be. o: {rax, ray, dir, s (mm/px)}
  function detectCrank(fg, W, H, o) {
    const s = o.s, rMin = Math.round(55 / s), rMax = Math.round(115 / s);
    let cx0 = o.rax + o.dir * 350 / s, cx1 = o.rax + o.dir * 480 / s;
    if (cx0 > cx1) [cx0, cx1] = [cx1, cx0];
    const cy0 = o.ray - 15 / s, cy1 = o.ray + 95 / s;
    const nx = Math.ceil(cx1 - cx0) + 1, ny = Math.ceil(cy1 - cy0) + 1, nr = rMax - rMin + 1;
    const X0 = Math.max(2, Math.floor(cx0 - rMax - 2)), X1 = Math.min(W - 3, Math.ceil(cx1 + rMax + 2));
    const Y0 = Math.max(2, Math.floor(cy0 - rMax - 2)), Y1 = Math.min(H - 3, Math.ceil(cy1 + rMax + 2));
    if (X1 - X0 < 20 || Y1 - Y0 < 20 || nr < 3) return null;
    const rw = X1 - X0 + 1, rh = Y1 - Y0 + 1, gx = new Float32Array(rw * rh), gy = new Float32Array(rw * rh), mg = new Float32Array(rw * rh);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const i = y * W + x, k = (y - Y0) * rw + (x - X0);
      gx[k] = (fg[i - W + 1] + 2 * fg[i + 1] + fg[i + W + 1]) - (fg[i - W - 1] + 2 * fg[i - 1] + fg[i + W - 1]);
      gy[k] = (fg[i + W - 1] + 2 * fg[i + W] + fg[i + W + 1]) - (fg[i - W - 1] + 2 * fg[i - W] + fg[i - W + 1]);
      mg[k] = Math.hypot(gx[k], gy[k]);
    }
    const thr = Float32Array.from(mg).sort()[Math.floor(mg.length * 0.7)];
    const acc = new Float32Array(nx * ny * nr);
    for (let k = 0; k < mg.length; k++) {
      if (mg[k] <= thr) continue;
      const x = X0 + (k % rw), y = Y0 + ((k / rw) | 0), ux = gx[k] / mg[k], uy = gy[k] / mg[k];
      for (let ri = 0; ri < nr; ri++) {
        const r = ri + rMin;
        for (const sg of [-1, 1]) {
          const ax = Math.round(x + sg * r * ux - cx0), ay = Math.round(y + sg * r * uy - cy0);
          if (ax < 0 || ay < 0 || ax >= nx || ay >= ny) continue;
          acc[(ri * ny + ay) * nx + ax] += 1;
        }
      }
    }
    // concentric evidence: for each centre, add up support over all radii (3x3 neighbourhood)
    let best = null;
    const cen = new Float32Array(nx * ny);
    for (let ay = 1; ay < ny - 1; ay++) for (let ax = 1; ax < nx - 1; ax++) {
      let tot = 0;
      for (let ri = 0; ri < nr; ri++) {
        let v = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v += acc[(ri * ny + ay + dy) * nx + ax + dx];
        v /= (ri + rMin);
        tot += v * v;
      }
      cen[ay * nx + ax] = tot;
      if (!best || tot > best.v) best = { v: tot, ax, ay };
    }
    if (!best) return null;
    // radius with most support at that centre
    let br = 0, bv = -1;
    for (let ri = 0; ri < nr; ri++) {
      let v = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v += acc[(ri * ny + best.ay + dy) * nx + best.ax + dx];
      v /= (ri + rMin);
      if (v > bv) { bv = v; br = ri + rMin; }
    }
    let c = { cx: cx0 + best.ax, cy: cy0 + best.ay, r: br };
    // refine: strongest edge along rays near that radius, robust circle fit
    let pts = [], rms = 0;
    for (let it = 0; it < 3; it++) {
      const cand = [];
      for (let a = 0; a < 360; a += 1.5) {
        const dx = Math.cos(a * Math.PI / 180), dy = Math.sin(a * Math.PI / 180), half = Math.max(3, 0.07 * c.r);
        let bm = 0, bt = 0, prev = null;
        for (let t = -half; t <= half; t += 0.5) {
          const v = bilinear(fg, W, H, c.cx + (c.r + t) * dx, c.cy + (c.r + t) * dy);
          if (prev != null && Math.abs(v - prev) > bm) { bm = Math.abs(v - prev); bt = t - 0.25; }
          prev = v;
        }
        if (bm > 6) cand.push([c.cx + (c.r + bt) * dx, c.cy + (c.r + bt) * dy]);
      }
      if (cand.length < 30) break;
      let keep = cand, k = null;
      for (let j = 0; j < 4; j++) {
        k = kasa(keep); if (!k) break;
        const res = cand.map(p => Math.hypot(p[0] - k.cx, p[1] - k.cy) - k.r);
        const sg = 1.4826 * median(keep.map(p => Math.abs(Math.hypot(p[0] - k.cx, p[1] - k.cy) - k.r)));
        keep = cand.filter((p, i) => Math.abs(res[i]) < Math.max(2.5 * sg, 0.6));
        if (keep.length < 25) break;
      }
      if (!k || keep.length < 25) break;
      if (Math.hypot(k.cx - c.cx, k.cy - c.cy) > 0.12 * c.r || Math.abs(k.r - c.r) > 0.12 * c.r) break; // refinement ran away
      c = k; pts = keep;
      rms = Math.sqrt(keep.reduce((a, p) => a + (Math.hypot(p[0] - k.cx, p[1] - k.cy) - k.r) ** 2, 0) / keep.length);
    }
    const sorted = Float32Array.from(cen).sort();
    const contrast = best.v / (sorted[Math.floor(sorted.length * 0.9)] || 1e-9);
    return { cx: c.cx, cy: c.cy, r: c.r, coverage: pts.length / 240, rms, contrast, hough: { cx: cx0 + best.ax, cy: cy0 + best.ay, r: br } };
  }
  // Seat tube / seatpost axis. o: {bbx, bby, dir, s, t0, t1 (mm from BB along the tube), guess (deg)}
  function detectSeatTube(fg, W, H, o) {
    const s = o.s, th = (o.guess || 73.5) * Math.PI / 180;
    const ux = -o.dir * Math.cos(th), uy = -Math.sin(th), px = -uy, py = ux; // u: up the tube; p: across
    const cs = [];
    for (let t = o.t0; t <= o.t1; t += 5) {
      const bx = o.bbx + ux * t / s, by = o.bby + uy * t / s, half = 55 / s, n = Math.round(2 * half / 0.5);
      const prof = new Float32Array(n + 1);
      let ok = true;
      for (let i = 0; i <= n; i++) {
        const q = -half + i * 0.5, x = bx + px * q, y = by + py * q;
        if (x < 2 || y < 2 || x > W - 3 || y > H - 3) { ok = false; break; }
        // average a little along the tube to suppress texture
        prof[i] = (bilinear(fg, W, H, x, y) + bilinear(fg, W, H, x + ux * 1.5, y + uy * 1.5) + bilinear(fg, W, H, x - ux * 1.5, y - uy * 1.5)) / 3;
      }
      if (!ok) continue;
      const d = new Float32Array(n + 1);
      for (let i = 3; i <= n - 3; i++) d[i] = (prof[i + 3] + prof[i + 2] + prof[i + 1] - prof[i - 1] - prof[i - 2] - prof[i - 3]) / 3;
      const ext = [];
      for (let i = 4; i <= n - 4; i++) if (Math.abs(d[i]) > 8 && Math.abs(d[i]) >= Math.abs(d[i - 1]) && Math.abs(d[i]) >= Math.abs(d[i + 1])) ext.push(i);
      let bp = null;
      for (let a = 0; a < ext.length; a++) for (let b = a + 1; b < ext.length; b++) {
        const i = ext[a], j = ext[b], w = (j - i) * 0.5 * s;
        if (w < 22 || w > 50 || d[i] * d[j] >= 0) continue;
        // interior should be fairly uniform (a tube, not two unrelated edges)
        let mn = 1e9, mx = -1e9;
        for (let k = i + 3; k <= j - 3; k++) { if (prof[k] < mn) mn = prof[k]; if (prof[k] > mx) mx = prof[k]; }
        const sc = Math.min(Math.abs(d[i]), Math.abs(d[j])) - 0.5 * (mx - mn);
        if (!bp || sc > bp.sc) bp = { sc, c: (-half + (i + j) * 0.25) * s, w };
      }
      if (bp && bp.sc > 4) cs.push({ t, c: bp.c, w: bp.w });
    }
    const nSt = Math.floor((o.t1 - o.t0) / 5) + 1;
    if (cs.length < 8) return { ok: false, n: cs.length, nSt };
    // robust line c = a + b t
    let keep = cs, a = 0, b = 0, sg = 0;
    const med = median(cs.map(q => q.c));
    keep = cs.filter(q => Math.abs(q.c - med) < 25);
    for (let it = 0; it < 6; it++) {
      if (keep.length < 6) return { ok: false, n: keep.length, nSt };
      let st = 0, sc = 0, stt = 0, stc = 0;
      for (const q of keep) { st += q.t; sc += q.c; stt += q.t * q.t; stc += q.t * q.c; }
      const m = keep.length, den = m * stt - st * st;
      b = (m * stc - st * sc) / den; a = (sc - b * st) / m;
      sg = 1.4826 * median(keep.map(q => Math.abs(q.c - a - b * q.t)));
      keep = cs.filter(q => Math.abs(q.c - a - b * q.t) < Math.max(2.5 * sg, 1.5));
    }
    const rms = Math.sqrt(keep.reduce((z, q) => z + (q.c - a - b * q.t) ** 2, 0) / keep.length);
    // p = (-uy, ux): a positive across-offset growing with t rotates the axis by atan(b)
    const dirv = [ux + b * px, uy + b * py];
    const ang = Math.atan2(-dirv[1], -o.dir * dirv[0]) * 180 / Math.PI;
    const tTop = Math.max(...keep.map(q => q.t)), span = tTop - Math.min(...keep.map(q => q.t));
    // angle of the line from the BB to the tube axis near its top: this is the line the eye expects
    const k = (a + b * tTop) / tTop, av = [ux + k * px, uy + k * py];
    const anchored = Math.atan2(-av[1], -o.dir * av[0]) * 180 / Math.PI;
    return { anchored, tTop, ok: keep.length >= 0.4 * nSt && rms < 2.5 && span > 0.5 * (o.t1 - o.t0) && Math.abs(a) < 30, angle: ang, offsetAtBB: a, rms, n: keep.length, nSt, span, width: median(keep.map(q => q.w)) };
  }
  // First dark-to-light step walking from (x,y) along (dx,dy), searched over [t0,t1] px. Returns t or null
  function edgeAlong(fg, W, H, x, y, dx, dy, t0, t1) {
    // the LAST strong dark-to-light step along the walk: gaps under a saddle (rails, clamp) come first and must be skipped
    const vals = [], g = [];
    for (let t = t0; t <= t1; t += 0.5) vals.push(bilinear(fg, W, H, x + dx * t, y + dy * t));
    let mx = 0;
    for (let i = 0; i < vals.length; i++) {
      g[i] = (i < 3 || i >= vals.length - 3) ? 0 : (vals[i + 1] + vals[i + 2] + vals[i + 3] - vals[i - 1] - vals[i - 2] - vals[i - 3]) / 3;
      if (g[i] > mx) mx = g[i];
    }
    if (mx <= 10) return null;
    for (let i = vals.length - 4; i >= 3; i--) if (g[i] >= 0.5 * mx && g[i] >= g[i - 1] && g[i] >= g[i + 1]) {
      const den = g[i - 1] - 2 * g[i] + g[i + 1], off = den < 0 ? 0.5 * (g[i - 1] - g[i + 1]) / den : 0;
      return t0 + (i + off) * 0.5;
    }
    return null;
  }

  return { solve, inverse, wls, mul3, inv3, apply, median, randn, cholesky, toGray, bilinear, detectWheels, fitEllipse, ellRadius, ellDist, ellExtents, fitWheel, kasa, fitTwoCircles, tiltH, mapPts, solveTilt, buildRect, fitScale, exifFocal, warpGray, detectCrank, detectSeatTube, edgeAlong };
})();
if (typeof module !== 'undefined') module.exports = Core;

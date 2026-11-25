"""Mountain bike (knobby tires): dots on the knob tips trace clean, the drive side is found, and the bike popup and mixed wheels work."""
import asyncio, subprocess, sys, time, shutil, pathlib, json
from playwright.async_api import async_playwright
T = pathlib.Path(__file__).resolve().parent; site = T / 'site'
shutil.copy(T.parent / 'dist' / 'index.html', site / 'standalone.html')
for f in (T / 'photos').glob('*'): shutil.copy(f, site / f.name)  # Daniel's test photos, kept out of git
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8017', '--directory', str(site)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8017/standalone.html'); await pg.wait_for_timeout(1500)
        await pg.evaluate("async () => { try { localStorage.clear(); } catch (e) {} const r = await fetch('mtb.jpg'); const bl = await r.blob(); await loadImage(new File([bl], 'mtb.jpg', { type: 'image/jpeg' }), null, { bike: 'mtb' }); }")
        await pg.wait_for_timeout(9000)
        rough = await pg.evaluate("() => ({ rough: S.rough, circles: S.roughC && S.roughC.map(c => [Math.round(c.cx), Math.round(c.cy), Math.round(c.r)]), ok: $('wizOk').textContent })")
        print('first guess thrown out:', rough)
        await pg.evaluate("() => { showStart(false); draw(); }"); await pg.screenshot(path='/tmp/mtb_rough.png')
        tr = await pg.evaluate("() => { S.roughC = [{ cx: 655, cy: 1160, r: 360 }, { cx: 1850, cy: 1180, r: 355 }]; wizOk(); return { rough: S.rough, q: S.wheels.map(wheelQuality), ok: $('wizOk').textContent }; }")
        print('after Trace from rough circles:', tr)
        await pg.screenshot(path='/tmp/mtb_traced.png')
        js = """([C, R, mixed]) => {
          for (const k of [0, 1]) {
            S.tirePts[k] = [-90, -20, 60, 120, 200].map(d => [C[k][0] + R[k] * Math.cos(d * Math.PI / 180), C[k][1] + R[k] * Math.sin(d * Math.PI / 180)]);
            S.tirePlaced[k] = S.tirePlaced[k].map(() => true); retraceWheel(k);
          }
          afterChange(); return null; }"""
        await pg.evaluate(js, [[[642.9, 1172.3], [1866.4, 1169.6]], [376, 374], False])
        await pg.evaluate("() => { showStart(false); draw(); }"); await pg.screenshot(path='/tmp/mtb.png')
        await pg.evaluate("() => { $('sideAsk').style.display = 'none'; S.view.mode = 'orig'; const W = cv.getBoundingClientRect().width, H = cv.getBoundingClientRect().height, span = 420, c = [643 - 250, 1172 + 150]; S.view.z = W / span; S.view.ox = c[0] - span / 2; S.view.oy = c[1] - span / 2 * H / W; draw(); }")
        await pg.screenshot(path='/tmp/mtb_zoom.png')
        res = await pg.evaluate("() => { const w = S.wheels[0], m = mmPerPx(); const r = w.pts.map(p => Core.ellDist(w.ell, p[0], p[1]) * m); const bins = {}; w.pts.forEach((p, i) => { const a = Math.round(Math.atan2(p[1] - w.ell.cy, p[0] - w.ell.cx) * 180 / Math.PI / 30) * 30; (bins[a] = bins[a] || []).push(r[i]); }); return Object.fromEntries(Object.entries(bins).map(([a, v]) => [a, [v.length, +(Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length)).toFixed(2)]])); }")
        print('rear rms by angle', res)
        out = await pg.evaluate("() => ({ W: S.img.W, side: S.side, sideAsked: S.sideAsked, wheels: S.wheels.map((w, k) => w && { cx: Math.round(w.ell.cx), a: +w.ell.a.toFixed(1), b: +w.ell.b.toFixed(1), q: wheelQuality(w), dots: S.tirePts[k].map((_, i) => tirePtColor(k, i)), rms_mm: +(w.rms * mmPerPx()).toFixed(2), cov: +w.coverage.toFixed(2) }), tire: S.tireSel, est: S.tireEst, sideAuto: S.sideAuto, conf: S.sideConf, grade: (gradePhoto() || {}).level, sc: (() => { S.sideKey = 0; S.sideAuto = null; detectSide(); const RA = S.rect.wheels[0].circ, ck = Core.detectCrank(S.fg, S.img.W, S.img.H, { rax: RA.cx, ray: RA.cy, dir: 1, s: S.sWork }); return [S.sideScore, S.sideAuto, ck && { cx: ck.cx, cy: ck.cy, r: ck.r, cov: ck.coverage, rms: ck.rms }]; })() })"); print(json.dumps(out))
        mixed = await pg.evaluate("() => { setBike('mtb', '29', '27.5'); return { D: [tireDk(0), tireDk(1)], rear: rearIdx(), list: $('tireSel').options.length, wheelsRow: $('wheelsRow').style.display, q: S.wheels.map(wheelQuality) }; }")
        print('mixed', mixed)
        fk = await pg.evaluate("() => { setBike('mtb', '29', '29'); S.forkSel = 'helm29-160'; S.wiz = null; S.tab = 'setup'; S.forkPlace = true; S.touched.hb = true; afterChange(); S.forkPlace = false; afterChange(); const f = forkRef(); return f && { readMm: +(f.px * S.scale.sx).toFixed(1), L: f.L, on: f.on, steerHA: S.vals && S.vals.headAngle }; }")
        st = await pg.evaluate("() => { S.wiz = null; S.setupDone = true; S.tab = 'geo'; S.sideAsked = true; S.view.mode = 'flat'; afterChange(); fitView(); return { stOff: S.stOff, htTouched: !!S.touched.ht, effShown: false }; }")
        await pg.screenshot(path='/tmp/mtb_geo.png')
        lk = await pg.evaluate("() => { const hs = S.handles.filter(h => h.key === 'lockSA' || h.key === 'lockSO').map(h => h.key); S.lockSA = true; S.lockSO = true; afterChange(); return { padlocks: hs, lockedHandles: S.handles.filter(h => h.key === 'stLocked').length }; }")
        print('seat tube:', st, lk)
        print('fork ref (HT bottom at its first guess):', fk)
        await pg.evaluate("() => askBike(new File([''], 'x.jpg'))"); await pg.wait_for_timeout(200); await pg.screenshot(path='/tmp/bikeask.png')
        await pg.click('#bikeMtb'); await pg.wait_for_timeout(200); await pg.screenshot(path='/tmp/bikeask2.png')
        await pg.click('#bikeCancel')
        print('errors', errs); await b.close()
asyncio.run(main()); srv.terminate()

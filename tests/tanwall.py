"""Tan sidewall: dots placed on the outer tread edge must keep the trace there, not on the tan/black edge inside it."""
import asyncio, subprocess, sys, time, shutil, pathlib, json
from playwright.async_api import async_playwright
T = pathlib.Path(__file__).resolve().parent; site = T / 'site'
shutil.copy(T.parent / 'dist' / 'index.html', site / 'standalone.html')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8017', '--directory', str(site)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8017/standalone.html'); await pg.wait_for_timeout(1500)
        await pg.evaluate("async () => { try { localStorage.clear(); } catch (e) {} const r = await fetch('brick.png'); const bl = await r.blob(); await loadImage(new File([bl], 'brick.png', { type: 'image/png' })); }")
        await pg.wait_for_timeout(9000)
        # dots on the outer tread edge, read off brightness profiles; [angle deg, radius px] about each auto centre
        edge = [[[-90, 511], [-18, 526], [54, 520], [126, 515], [-162, 510]], [[-90, 499], [-18, 518], [54, 524], [126, 519], [-162, 509]]]
        check = [[[90, 516], [126, 515], [-162, 510]], [[90, 522], [54, 524], [-18, 518]]]  # outer edge where it can be read
        C = [[671.1, 1309.5], [2167.6, 1301.3]]
        js = """([C, edge, check]) => {
          const mm = 682 / 1040, res = {};
          for (const k of [0, 1]) {
            S.tirePts[k] = edge[k].map(([d, r]) => [C[k][0] + r * Math.cos(d * Math.PI / 180), C[k][1] + r * Math.sin(d * Math.PI / 180)]);
            S.tirePlaced[k] = S.tirePlaced[k].map(() => true);
            const e = ptsToEll(S.tirePts[k]);
            const off = w => w ? check[k].map(([d, r]) => { const th = d * Math.PI / 180, x = C[k][0] + r * Math.cos(th), y = C[k][1] + r * Math.sin(th); return +(Core.ellDist(w.ell, x, y) * mm).toFixed(1); }) : null;
            const old = Core.fitWheelHand(S.img.gray, S.img.W, S.img.H, e, 0);
            retraceWheel(k);
            res[k] = { old_mm_off: off(old), new_mm_off: off(S.wheels[k]), dots: S.tirePts[k].map((_, i) => tirePtColor(k, i)), rms_mm: +(S.wheels[k].rms * mm).toFixed(2), cov: +S.wheels[k].coverage.toFixed(2) };
          }
          afterChange(); return res; }"""
        print(json.dumps(await pg.evaluate(js, [C, edge, check])))
        await pg.evaluate("() => { showStart(false); $('sideAsk').style.display = 'none'; draw(); }")
        await pg.screenshot(path='/tmp/tanwall.png')
        await pg.evaluate("() => { const r = cv.getBoundingClientRect(); window._r = r; }")
        await pg.evaluate("() => { S.view.mode = 'flat'; const W = cv.getBoundingClientRect().width, H = cv.getBoundingClientRect().height, span = 260, c = [671.1 - 300, 1309.5 + 420]; S.view.z = W / span; S.view.ox = c[0] - span / 2; S.view.oy = c[1] - span / 2 * H / W; draw(); }")
        await pg.screenshot(path='/tmp/tanwall_zoom.png')
        print('errors', errs); await b.close()
asyncio.run(main()); srv.terminate()

"""Phone gestures: pinch zooms, and a second finger puts back a point the first finger started moving. Run after tests/check.py."""
import asyncio, subprocess, sys, time, pathlib, shutil
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent; site = root / 'tests' / 'site'
shutil.copy(root / 'dist' / 'index.html', site / 'standalone.html')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8012', '--directory', str(site)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8012/standalone.html'); await pg.wait_for_timeout(2000)
        print('start screen shown:', await pg.evaluate("() => $('start').style.display"), 'setup bar:', await pg.evaluate("() => $('wiz').style.display"))
        await pg.evaluate("() => $('startGood').click()"); await pg.wait_for_timeout(9000)
        cdp = await ctx.new_cdp_session(pg)
        r = await pg.evaluate("() => { const r = cv.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")
        cx, cy = r[0] + r[2] / 2, r[1] + 120
        z0 = await pg.evaluate("() => S.view.z")
        T = lambda typ, pts: cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
        await T('touchStart', [(cx - 30, cy), (cx + 30, cy)])
        for k in range(1, 9):
            await T('touchMove', [(cx - 30 - 10 * k, cy), (cx + 30 + 10 * k, cy)]); await pg.wait_for_timeout(30)
        await T('touchEnd', [])
        await pg.wait_for_timeout(300)
        z1 = await pg.evaluate("() => S.view.z")
        print('pinch out: zoom', round(z0, 3), '->', round(z1, 3), 'x', round(z1 / z0, 2))
        # one-finger drag on empty photo pans; a point dragged with one finger then a second finger: the point goes back
        pts0 = await pg.evaluate("() => JSON.stringify(S.tirePts)")
        h = await pg.evaluate("() => { const h = S.handles[0]; return [h.x, h.y]; }")
        hx, hy = r[0] + h[0], r[1] + h[1]
        await T('touchStart', [(hx, hy)])
        for k in range(1, 5): await T('touchMove', [(hx + 4 * k, hy)]); await pg.wait_for_timeout(30)
        await T('touchStart', [(hx + 16, hy), (hx + 120, hy + 40)])
        for k in range(1, 5): await T('touchMove', [(hx + 16 - 5 * k, hy), (hx + 120 + 5 * k, hy + 40)]); await pg.wait_for_timeout(30)
        await T('touchEnd', []); await pg.wait_for_timeout(300)
        print('point put back after pinch started:', await pg.evaluate("() => JSON.stringify(S.tirePts)") == pts0)
        print('errors', errs); await b.close()
asyncio.run(main()); srv.terminate()

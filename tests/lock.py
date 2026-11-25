"""Locked steering controls: holding one shows guide lines and shakes it; it never moves."""
import asyncio, subprocess, sys, time, shutil, pathlib
from playwright.async_api import async_playwright
site = pathlib.Path(__file__).resolve().parent / 'site'; shutil.copy(pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'index.html', site / 'standalone.html')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8016', '--directory', str(site)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8016/standalone.html'); await pg.wait_for_timeout(2000)
        await pg.evaluate("async () => { try { localStorage.clear(); } catch (e) {} await loadImage(EXAMPLES.dead.src, EXAMPLES.dead); }"); await pg.wait_for_timeout(9000)
        await pg.evaluate("() => { S.wiz = null; S.setupDone = true; S.tab = 'geo'; S.lockA = true; S.lockX = true; showStart(false); afterChange(); }"); await pg.click('#zFit'); await pg.click('#zIn'); await pg.click('#zIn'); await pg.wait_for_timeout(400)
        box = await pg.evaluate("() => { const r = cv.getBoundingClientRect(); return [r.left, r.top]; }")
        st = "() => ({ HA: +S.vals.headAngle.toFixed(3), G: S.steer.g.map(v => +v.toFixed(1)), shake: S.shake && S.shake.id, tip: lockTip.style.display !== 'none' && lockTip.textContent })"
        for nm, idx in [('angle arc', 0), ('slider', 1)]:
            h = await pg.evaluate(f"() => {{ const hs = S.handles.filter(h => h.key === 'steerLocked'); return [hs[{idx}].x, hs[{idx}].y]; }}")
            x, y = box[0] + h[0], box[1] + h[1]
            before = await pg.evaluate(st)
            await pg.mouse.move(x, y); await pg.mouse.down(); await pg.wait_for_timeout(120)
            during = await pg.evaluate(st); guides = await pg.evaluate("() => !!(S.drag && S.drag.axis && S.drag.axis.key === 'steerLocked')")
            await pg.screenshot(path=f'/tmp/lock_{idx}.png', clip={'x': x - 160, 'y': y - 160, 'width': 320, 'height': 320})
            for k in range(1, 6): await pg.mouse.move(x + 8 * k, y - 4 * k); await pg.wait_for_timeout(20)
            await pg.mouse.up(); await pg.wait_for_timeout(300)
            after = await pg.evaluate(st)
            print(nm, '| guides while held:', guides, '| shaking:', during['shake'], '| tip:', during['tip'], '| moved:', before['HA'] != after['HA'] or before['G'] != after['G'])
        print('errors', errs); await b.close()
asyncio.run(main()); srv.terminate()

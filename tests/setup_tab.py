"""Setup tab: which panels show, and the Redo tires / Redo BB buttons."""
import asyncio, subprocess, sys, time, shutil, pathlib
from playwright.async_api import async_playwright
site = pathlib.Path(__file__).resolve().parent / 'site'; shutil.copy(pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'index.html', site / 'standalone.html')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8017', '--directory', str(site)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 1000})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8017/standalone.html'); await pg.wait_for_timeout(1500)
        await pg.evaluate("async () => { try { localStorage.clear(); } catch (e) {} showStart(false); await loadImage(EXAMPLES.dead.src, EXAMPLES.dead); }"); await pg.wait_for_timeout(9000)
        await pg.evaluate("() => { S.wiz = null; S.setupDone = true; S.tab = 'setup'; afterChange(); }"); await pg.wait_for_timeout(500)
        print('visible setup panels:', await pg.evaluate("() => [...document.querySelectorAll('#aside > .panel')].filter(p => p.offsetParent).map(p => p.id || p.querySelector('h2, summary')?.textContent)"))
        await pg.screenshot(path='' + str(pathlib.Path(__file__).resolve().parent / 'out' / 'setup-tab.png') + '', clip={'x': 1020, 'y': 0, 'width': 420, 'height': 1000})
        await pg.click('#redoBB'); await pg.wait_for_timeout(800); print('Redo BB ->', await pg.evaluate("() => WIZ[S.wiz].k"))
        await pg.evaluate("() => { S.wiz = null; afterChange(); }"); await pg.click('#redoTires'); await pg.wait_for_timeout(800); print('Redo tires ->', await pg.evaluate("() => WIZ[S.wiz].k"))
        print('errors', errs); await b.close()
asyncio.run(main()); srv.terminate()

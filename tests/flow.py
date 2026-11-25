"""The setup flow, start to finish, in the store build at desktop and phone size. Screenshots of each screen in tests/out/flow-*."""
import asyncio, subprocess, sys, time, pathlib, shutil
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent; site = root / 'tests' / 'site'; out = root / 'tests' / 'out'
shutil.copy(root / 'dist' / 'shopify' / 'datum.js', site / 'datum.js'); shutil.copy(root / 'sandbox' / 'index.html', site / 'index.html')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8013', '--directory', str(site)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
R = "document.querySelector('datum-app').shadowRoot"
async def run(b, nm, vp, mobile):
    pg = await b.new_page(viewport=vp, has_touch=mobile, is_mobile=mobile, device_scale_factor=2 if mobile else 1)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto('http://localhost:8013/index.html'); await pg.wait_for_timeout(2500)
    async def click(sel): await pg.evaluate(f"() => {R}.querySelector('{sel}').click()"); await pg.wait_for_timeout(1500)
    async def state(): return await pg.evaluate(f"() => {{ const r = {R}; return {{ note: r.querySelector('#note').style.display === 'flex' ? r.querySelector('#noteTitle').textContent : null, step: (r.querySelector('#wizTitle') || {{}}).textContent, wizOn: r.querySelector('#wiz').style.display !== 'none' }}; }}")
    async def shot(k): await pg.screenshot(path=str(out / f'flow-{nm}-{k}.png'))
    await shot('1-start')
    await click('#startGood'); await pg.wait_for_timeout(8000); await shot('2-tires'); print(nm, 'tires', await state())
    await click('#wizOk'); await shot('3-bb'); print(nm, 'after OK', await state())
    await click('#wizOk'); await shot('4-scale'); print(nm, 'after OK', await state())
    await pg.evaluate(f"() => {{ const i = {R}.querySelector('#wb'); i.value = '1007.7'; i.dispatchEvent(new Event('change')); }}"); await pg.wait_for_timeout(500)
    await click('#wizOk'); await shot('5-fit'); print(nm, 'after OK', await state())
    print(nm, 'errors', errs); await pg.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await run(b, 'desktop', {'width': 1440, 'height': 900}, False)
        await run(b, 'phone', {'width': 390, 'height': 844}, True)
        await b.close()
asyncio.run(main()); srv.terminate()

"""DATUM checks. Run after every change:  python3 tests/check.py   (add --update-baseline after an approved change)

1. Numbers: the standalone build loads the tilted and dead-on examples with their saved points; every number must match
   tests/baseline.json (0.05 tolerance), so a change can't move a measurement without anyone noticing.
2. Store build: datum.js in the sandbox page (a stand-in for the Shopify page, with clashing styles) at desktop and
   phone size: it mounts, an example loads and traces, no page errors. Screenshots go to tests/out/.
"""
import asyncio, json, pathlib, subprocess, sys, time, shutil
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'tests' / 'out'; out.mkdir(exist_ok=True)
site = root / 'tests' / 'site'
if site.exists(): shutil.rmtree(site)
(site / 'examples').mkdir(parents=True)
shutil.copy(root / 'dist' / 'index.html', site / 'standalone.html')
shutil.copy(root / 'dist' / 'shopify' / 'datum.js', site / 'datum.js')
shutil.copy(root / 'sandbox' / 'index.html', site / 'index.html')
for f in (root / 'examples').glob('*.jpg'): shutil.copy(f, site / 'examples' / f.name)
PORT = 8011
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', str(site)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
KEYS = ['stack', 'reach', 'headTube', 'headAngle', 'seatAngle', 'ett', 'seatTube', 'bbDrop', 'chainstay', 'wheelbase', 'frontCentre', 'rearCentre',
        'forkLength', 'forkOffset', 'trail', 'bbHeight', 'saddleHeight', 'saddleSetback', 'sweetSpotSetback', 'drop', 'saddleToBarReach', 'noseToBarDirect',
        'Hx', 'Hy', 'barH', 'barTheta', 'saddleLen', 'saddleTilt']
fails = []
async def numbers(b):
    res = {}
    pg = await b.new_page(viewport={'width': 1440, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(f'http://localhost:{PORT}/standalone.html'); await pg.wait_for_timeout(3000)
    for ex in ['tilted', 'dead']:
        await pg.evaluate(f"async () => {{ try {{ localStorage.clear(); }} catch (e) {{}} await loadImage(EXAMPLES.{ex}.src, EXAMPLES.{ex}); }}")
        await pg.wait_for_timeout(9000)
        await pg.evaluate("() => { S.wiz = null; S.setupDone = true; afterChange(); }"); await pg.wait_for_timeout(500)
        res[ex] = await pg.evaluate(f"() => {{ const o = {{}}; for (const k of {json.dumps(KEYS)}) if (S.vals && S.vals[k] != null) o[k] = Math.round(S.vals[k] * 100) / 100; return o; }}")
    if errs: fails.append(f'standalone page errors: {errs}')
    await pg.close(); return res
async def store(b):
    for nm, vp in [('desktop', {'width': 1440, 'height': 900}), ('phone', {'width': 390, 'height': 844})]:
        pg = await b.new_page(viewport=vp, device_scale_factor=2 if nm == 'phone' else 1, has_touch=nm == 'phone', is_mobile=nm == 'phone')
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'http://localhost:{PORT}/index.html'); await pg.wait_for_timeout(2500)
        R = "document.querySelector('datum-app').shadowRoot"
        mounted = await pg.evaluate(f"() => !!{R} && !!{R}.querySelector('#cv')")
        if not mounted: fails.append(f'{nm}: datum-app did not mount'); await pg.close(); continue
        await pg.screenshot(path=str(out / f'{nm}-start.png'))
        # load the good-tracing example: from the start screen if there is one, else the header button
        await pg.evaluate(f"() => {{ const r = {R}; const b = r.querySelector('#startGood') || r.querySelector('#exDead'); b.click(); }}")
        await pg.wait_for_timeout(10000)
        st = await pg.evaluate(f"() => {{ const r = {R}, c = r.querySelector('#cv'), g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < g.length; i += 4 * 997) if (g[i] > 0) n++; return {{ wiz: (r.querySelector('#wizTitle') || {{}}).textContent || '', drawn: n > 20, foot: r.querySelector('footer').textContent }}; }}")
        if not st['drawn']: fails.append(f'{nm}: photo not drawn after loading the example')
        if 'Tire' not in st['wiz']: fails.append(f"{nm}: setup did not reach the tire step ({st['wiz']!r})")
        await pg.screenshot(path=str(out / f'{nm}-example.png'))
        if errs: fails.append(f'{nm}: page errors {errs}')
        print(f'  store {nm}: mounted, example drawn={st["drawn"]}, step={st["wiz"]!r}, footer={st["foot"]!r}')
        await pg.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        try:
            res = await numbers(b)
            bl = root / 'tests' / 'baseline.json'
            if '--update-baseline' in sys.argv or not bl.exists():
                bl.write_text(json.dumps(res, indent=1)); print('  baseline written')
            else:
                base = json.loads(bl.read_text())
                for ex in base:
                    for k, v in base[ex].items():
                        n = res.get(ex, {}).get(k)
                        if n is None or abs(n - v) > 0.05: fails.append(f'number moved: {ex} {k} {v} -> {n}')
                print(f'  numbers: {sum(len(v) for v in base.values())} compared')
            await store(b)
        finally:
            await b.close()
asyncio.run(main())
srv.terminate()
print('FAIL\n  ' + '\n  '.join(fails) if fails else 'OK')
sys.exit(1 if fails else 0)

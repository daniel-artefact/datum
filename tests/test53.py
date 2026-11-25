import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8001/index.html'); await pg.wait_for_timeout(8000)
        await pg.evaluate("() => { S.wiz = null; S.setupDone = true; S.tab='geo'; afterChange(); }"); await pg.click('#zFit'); await pg.wait_for_timeout(300)
        await pg.click('#zIn'); await pg.click('#zIn'); await pg.wait_for_timeout(300)
        box = await pg.evaluate("() => { const r = cv.getBoundingClientRect(); return [r.left, r.top]; }")
        H = lambda k: pg.evaluate(f"() => S.handles.filter(h => h.key === '{k}').map(h => [h.x, h.y])")
        lk = (await H('steerlock'))[0]
        await pg.screenshot(path='/tmp/lock0.png', clip={'x':box[0]+lk[0]-120,'y':box[1]+lk[1]-120,'width':240,'height':240})
        await pg.mouse.click(box[0]+lk[0], box[1]+lk[1]); await pg.wait_for_timeout(300)
        print('locked', await pg.evaluate("() => S.steerLock"), 'steer handles', len(await H('steer')))
        await pg.screenshot(path='/tmp/lock1.png', clip={'x':box[0]+lk[0]-120,'y':box[1]+lk[1]-120,'width':240,'height':240})
        HA0 = await pg.evaluate("() => S.vals.headAngle")
        ht = (await H('ht'))[0]; x, y = box[0]+ht[0], box[1]+ht[1]
        await pg.mouse.move(x, y); await pg.mouse.down()
        for i in range(1, 5): await pg.mouse.move(x+5*i, y-4*i); await pg.wait_for_timeout(20)
        await pg.mouse.up(); await pg.wait_for_timeout(300)
        print('HA unchanged after HT drag while locked:', round(HA0, 3), round(await pg.evaluate("() => S.vals.headAngle"), 3))
        lk = (await H('steerlock'))[0]
        await pg.mouse.click(box[0]+lk[0], box[1]+lk[1]); await pg.wait_for_timeout(300)
        print('unlocked', not await pg.evaluate("() => S.steerLock"), 'steer handles', len(await H('steer')))
        print('errors', errs); await b.close()
asyncio.run(main())

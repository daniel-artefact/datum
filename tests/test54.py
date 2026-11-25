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
        st = "() => ({HA: +S.vals.headAngle.toFixed(2), X: +Core.apply(S.rect.H, ...S.steer.g)[0].toFixed(1), lockA: S.lockA, lockX: S.lockX, loupe: loupe.style.display})"
        async def press(k):
            h = (await H(k))[0]; x, y = box[0]+h[0], box[1]+h[1]
            await pg.mouse.move(x, y); await pg.mouse.down(); await pg.wait_for_timeout(150)
            lp = await pg.evaluate("() => loupe.style.display"); await pg.mouse.up(); await pg.wait_for_timeout(250); return lp
        async def dragHT(dx, dy):
            h = (await H('ht'))[0]; x, y = box[0]+h[0], box[1]+h[1]
            await pg.mouse.move(x, y); await pg.mouse.down()
            for i in range(1, 5): await pg.mouse.move(x+dx*i/4, y+dy*i/4); await pg.wait_for_timeout(20)
            await pg.mouse.up(); await pg.wait_for_timeout(250)
        lk0 = (await H('lockA'))[0]
        await pg.screenshot(path='/tmp/locks0.png', clip={'x':box[0]+lk0[0]-130,'y':box[1]+lk0[1]-90,'width':240,'height':200})
        print('start         ', await pg.evaluate(st))
        print('press lockA, loupe during press:', await press('lockA'), await pg.evaluate(st))
        await dragHT(8, 0); print('HT drag, angle locked  ', await pg.evaluate(st))
        await press('lockA'); await press('lockX')
        await dragHT(8, 0); print('HT drag, X locked      ', await pg.evaluate(st))
        await press('lockA')
        await dragHT(8, -6); print('HT drag, both locked   ', await pg.evaluate(st))
        print('handles steer when both locked:', len(await H('steer')))
        await pg.screenshot(path='/tmp/locks1.png', clip={'x':box[0]+lk0[0]-130,'y':box[1]+lk0[1]-90,'width':240,'height':200})
        print('errors', errs); await b.close()
asyncio.run(main())

import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8001/index.html'); await pg.wait_for_timeout(8000)
        await pg.evaluate("() => { S.wiz = null; S.setupDone = true; S.tab='geo'; afterChange(); }"); await pg.click('#zFit'); await pg.wait_for_timeout(500)
        box = await pg.evaluate("() => { const r = cv.getBoundingClientRect(); return [r.left, r.top]; }")
        V = "() => [+S.vals.headAngle.toFixed(2), +S.vals.forkA2C.toFixed(1), $('undo').disabled, $('redo').disabled]"
        print('start      ', await pg.evaluate(V))
        for dx in (8, 6):
            s = await pg.evaluate("() => { const h = S.handles.find(h => h.key === 'ht'); return [h.x, h.y]; }")
            x, y = box[0]+s[0], box[1]+s[1]
            await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x+dx/2, y); await pg.mouse.move(x+dx, y); await pg.mouse.up(); await pg.wait_for_timeout(300)
            print('drag HT', dx, ' ', await pg.evaluate(V))
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300); print('ctrl+z     ', await pg.evaluate(V))
        await pg.click('#undo'); await pg.wait_for_timeout(300); print('undo btn   ', await pg.evaluate(V))
        await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(300); print('ctrl+y     ', await pg.evaluate(V))
        await pg.click('#redo'); await pg.wait_for_timeout(300); print('redo btn   ', await pg.evaluate(V))
        await pg.evaluate("() => { ['steer','st','ht','hb','stt'].forEach(k => S.touched[k] = true); afterChange(); }"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/u.png')
        print('errors', errs); await b.close()
asyncio.run(main())

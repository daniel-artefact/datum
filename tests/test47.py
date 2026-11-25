import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8001/index.html'); await pg.wait_for_timeout(8000)
        await pg.evaluate("() => { S.wiz = null; S.setupDone = true; S.tab='geo'; ['steer','st','sd','ht','hb','stt'].forEach(k => S.touched[k] = true); afterChange(); }"); await pg.click('#zFit'); await pg.wait_for_timeout(500)
        box = await pg.evaluate("() => { const r = cv.getBoundingClientRect(); return [r.left, r.top]; }")
        V = "() => ({HA: +S.vals.headAngle.toFixed(2), STA: +S.sta.angle.toFixed(2), touched: Object.keys(S.touched).sort().join(',')})"
        async def drag(key, idx, dx, dy):
            hs = await pg.evaluate(f"() => S.handles.filter(h => h.key === '{key}').map(h => [h.x, h.y])")
            x, y = box[0]+hs[idx][0], box[1]+hs[idx][1]
            await pg.mouse.move(x, y); await pg.mouse.down()
            for i in range(1, 6): await pg.mouse.move(x+dx*i/5, y+dy*i/5); await pg.wait_for_timeout(20)
            await pg.mouse.up(); await pg.wait_for_timeout(300)
        print('start             ', await pg.evaluate(V))
        await pg.screenshot(path='/tmp/s0.png', clip={'x':520,'y':380,'width':260,'height':220})
        await drag('steer', 0, 3, 0); print('small turn        ', await pg.evaluate(V))
        await drag('steer', 0, 40, 0); print('big turn          ', await pg.evaluate(V))
        await pg.evaluate("() => { ['ht','hb'].forEach(k => S.touched[k] = true); afterChange(); }")
        await drag('steer', 1, 1, 0); print('small slide       ', await pg.evaluate(V))
        await drag('steer', 1, 8, 0); print('big slide         ', await pg.evaluate(V))
        await drag('st', 0, 2, 0); print('small STA         ', await pg.evaluate(V))
        await drag('st', 0, 25, 0); print('big STA           ', await pg.evaluate(V))
        print('errors', errs); await b.close()
asyncio.run(main())

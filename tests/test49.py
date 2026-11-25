import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8001/index.html'); await pg.wait_for_timeout(8000)
        await pg.evaluate("() => { S.wiz = null; S.setupDone = true; S.view.mode='flat'; S.tab='fit'; afterChange(); }"); await pg.click('#zFit'); await pg.wait_for_timeout(500)
        box = await pg.evaluate("() => { const r = cv.getBoundingClientRect(); return [r.left, r.top]; }")
        async def grab(tab, key, idx, name):
            await pg.evaluate(f"() => {{ S.tab='{tab}'; afterChange(); }}"); await pg.wait_for_timeout(300)
            hs = await pg.evaluate(f"() => S.handles.filter(h => h.key === '{key}').map(h => [h.x, h.y])")
            x, y = box[0]+hs[idx][0], box[1]+hs[idx][1]
            await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x+1, y); await pg.mouse.move(x+3, y); await pg.wait_for_timeout(250)
            r = await pg.evaluate("() => { const r = loupe.getBoundingClientRect(); return [r.left, r.top, r.width, r.height, loupe.className]; }")
            print(name, [round(v) for v in r[:4]], r[4], 'click', [round(x), round(y)])
            await pg.screenshot(path=f'/tmp/{name}.png', clip={'x':r[0],'y':r[1],'width':r[2],'height':r[3]})
            await pg.mouse.up(); await pg.wait_for_timeout(200)
        await grab('fit', 'st', 0, 'axST')
        await grab('geo', 'steer', 0, 'axHA')
        await grab('geo', 'steer', 1, 'axHX')
        await grab('fit', 'sn', 0, 'normal')
        print('errors', errs); await b.close()
asyncio.run(main())

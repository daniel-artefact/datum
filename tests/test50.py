import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8001/index.html'); await pg.wait_for_timeout(8000)
        await pg.evaluate("() => { S.wiz = null; S.setupDone = true; S.view.mode='flat'; S.tab='fit'; ['steer','st','sd','ht','hb','stt'].forEach(k => S.touched[k] = true); S.base = {}; afterChange(); recompute(); baseCheck(null); }"); await pg.click('#zFit'); await pg.wait_for_timeout(500)
        box = await pg.evaluate("() => { const r = cv.getBoundingClientRect(); return [r.left, r.top]; }")
        V = "() => ({STA: +S.sta.angle.toFixed(2), HA: +S.vals.headAngle.toFixed(2), yellow: ['sd','stt','ht','hb'].filter(k => !S.touched[k]).join(','), loupe: loupe.style.display})"
        async def drag(tab, key, idx, dx, shot=None):
            await pg.evaluate(f"() => {{ S.tab='{tab}'; afterChange(); }}"); await pg.wait_for_timeout(200)
            hs = await pg.evaluate(f"() => S.handles.filter(h => h.key === '{key}').map(h => [h.x, h.y])")
            x, y = box[0]+hs[idx][0], box[1]+hs[idx][1]
            await pg.mouse.move(x, y); await pg.mouse.down()
            for i in range(1, 5): await pg.mouse.move(x+dx*i/4, y); await pg.wait_for_timeout(20)
            if shot: await pg.screenshot(path=shot)
            lp = await pg.evaluate("() => loupe.style.display")
            await pg.mouse.up(); await pg.wait_for_timeout(250)
            return lp
        print('start            ', await pg.evaluate(V))
        for i in range(4):
            lp = await drag('fit', 'st', 0, 1, '/tmp/g_st.png' if i == 0 else None)
            print(f'tiny STA nudge {i+1} ', await pg.evaluate(V), 'loupe during drag:', lp)
        await pg.evaluate("() => { ['sd','stt'].forEach(k => S.touched[k] = true); S.base.sd = baseVal('sd'); S.base.stt = baseVal('stt'); afterChange(); }")
        for i in range(3):
            lp = await drag('geo', 'steer', 0, 2, '/tmp/g_ht.png' if i == 0 else None)
            print(f'HA nudge {i+1}       ', await pg.evaluate(V), 'loupe:', lp)
        await drag('geo', 'steer', 1, 10); print('big slide        ', await pg.evaluate(V))
        await pg.evaluate("() => { S.tab='setup'; afterChange(); }"); await pg.wait_for_timeout(300)
        await pg.fill('#wb', '1030'); await pg.dispatch_event('#wb', 'change'); await pg.wait_for_timeout(300)
        await pg.evaluate("() => { ['sd','stt','ht','hb'].forEach(k => S.touched[k] = true); S.base = {}; recompute(); baseCheck(null); }")
        await pg.fill('#wb', '1100'); await pg.dispatch_event('#wb', 'change'); await pg.wait_for_timeout(300)
        await drag('fit', 'sn', 0, 2); print('after scale change + unrelated drag', await pg.evaluate(V))
        print('errors', errs); await b.close()
asyncio.run(main())

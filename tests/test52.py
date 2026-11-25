import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8001/index.html'); await pg.wait_for_timeout(8000)
        await pg.evaluate("() => { S.wiz = null; S.setupDone = true; S.tab='geo'; ['steer','st','sd','ht','hb','stt'].forEach(k => S.touched[k] = true); afterChange(); }"); await pg.click('#zFit'); await pg.wait_for_timeout(400)
        V = "() => { const v = S.vals, r = x => x == null ? null : +x.toFixed(1); return { SA: r(v.seatAngle), SAact: r(v.seatAngleActual), A: r(v.stOffsetA), ETT: r(v.ett), SH: r(v.saddleHeight), STL: r(v.seatTube), SAsaddle: r(v.effSeatAngleSaddle), fork: r(v.forkLength), CS: r(v.chainstay), RC: r(v.rearCentre), FC: r(v.frontCentre), drop: r(v.drop), butt: r(v.saddleToBarReach), nose2bar: r(v.noseToBarDirect), H: r(v.barH), th: r(v.barTheta), chart: S.chartId } }"
        print('straight   ', await pg.evaluate(V))
        await pg.evaluate("() => { S.tab='setup'; afterChange(); }"); await pg.click('#stOffset'); await pg.wait_for_timeout(300)
        await pg.evaluate("() => { S.stA = 20; S.tab='geo'; afterChange(); }"); await pg.wait_for_timeout(400)
        print('offset A20 ', await pg.evaluate(V))
        await pg.screenshot(path='/tmp/off_geo.png')
        box = await pg.evaluate("() => { const r = cv.getBoundingClientRect(); return [r.left, r.top]; }")
        h = await pg.evaluate("() => { const h = S.handles.find(h => h.key === 'stoff'); return h && [h.x, h.y]; }")
        print('slider handle', h)
        x, y = box[0]+h[0], box[1]+h[1]
        await pg.mouse.move(x, y); await pg.mouse.down()
        for i in range(1, 6): await pg.mouse.move(x - 2*i, y); await pg.wait_for_timeout(20)
        await pg.screenshot(path='/tmp/off_drag.png')
        await pg.mouse.up(); await pg.wait_for_timeout(300)
        print('after slide', await pg.evaluate("() => S.stA"), await pg.evaluate(V))
        await pg.evaluate("() => { S.tab='fit'; afterChange(); }"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/off_fit.png')
        print('fit table', await pg.evaluate("() => [...document.querySelectorAll('#fitOut tr')].map(r => r.innerText.replace(/\\s+/g,' ')).join(' | ')"))
        await pg.evaluate("() => { S.tab='geo'; afterChange(); }"); await pg.wait_for_timeout(300)
        print('geo table', await pg.evaluate("() => [...document.querySelectorAll('#geoOut tr')].map(r => r.innerText.replace(/\\s+/g,' ')).join(' | ')"))
        print('charts', await pg.evaluate("() => [...$('chartSel').options].map(o => o.text).join(', ')"))
        print('errors', errs); await b.close()
asyncio.run(main())

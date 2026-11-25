import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8001/index.html'); await pg.wait_for_timeout(8000)
        await pg.set_input_files('#file', '/home/claude/testimg/bags.jpg'); await pg.wait_for_timeout(10000)
        print('auto', await pg.evaluate("() => [S.sideAuto, S.sideConf, S.side, S.wiz != null && WIZ[S.wiz].k, $('sideAsk').style.display]"))
        await pg.screenshot(path='/tmp/ask.png')
        if await pg.evaluate("() => $('sideAsk').style.display") == 'block':
            await pg.click('#askDrive'); await pg.wait_for_timeout(2500)
            print('after answer', await pg.evaluate("() => [S.side, S.sideSet, S.sideAsked, $('sideAsk').style.display, S.wiz != null && WIZ[S.wiz].k, S.bbDepth]"))
            await pg.screenshot(path='/tmp/ask2.png')
        print('errors', errs); await b.close()
asyncio.run(main())

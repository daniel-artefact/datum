import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8001/index.html'); await pg.wait_for_timeout(8000)
        for btn in ['Example: tilted', 'Example: dead-on', 'Example: stairs']:
            await pg.get_by_role('button', name=btn).click(); await pg.wait_for_timeout(9000)
            print(btn, await pg.evaluate("() => [S.sideAuto, S.sideConf, $('sideAsk').style.display, S.bbDepth]"))
        for f in ['vignette.jpg']:
            await pg.set_input_files('#file', '/home/claude/testimg/' + f); await pg.wait_for_timeout(9000)
            print(f, await pg.evaluate("() => [S.sideAuto, S.sideConf, $('sideAsk').style.display]"))
        print('errors', errs); await b.close()
asyncio.run(main())

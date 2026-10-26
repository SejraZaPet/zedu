"""Regression: class/group picker in Losování/Skupiny must be VISIBLE above the
classroom-tools overlay (normal + fullscreen), clicked for real, not programmatically.
Run: python3 e2e/classroom_select_visible.py  (needs dev server on :8080 and a minted
session in ~/.cache/lovable-auth/session.json). Absence toggles touch only localStorage
of this throw-away browser context."""
import asyncio, json, os, re, sys
from playwright.async_api import async_playwright, expect

OUT = "/tmp/browser/sel"; os.makedirs(OUT, exist_ok=True)

async def pick(page, label, tool):
    await page.get_by_role("combobox", name="Třída nebo skupina").click()
    opts = page.get_by_role("option")
    await opts.first.wait_for(state="visible", timeout=10000)
    names = [(await opts.nth(i).inner_text()).strip() for i in range(await opts.count())]
    target = next(opts.nth(i) for i, n in enumerate(names) if n != "Vlastní seznam")
    await target.scroll_into_view_if_needed()
    await expect(target).to_be_visible()
    box = await target.bounding_box()
    hit = await page.evaluate("([x,y])=>!!document.elementFromPoint(x,y)?.closest('[role=option]')",
                              [box["x"] + box["width"] / 2, box["y"] + box["height"] / 2])
    await page.screenshot(path=f"{OUT}/{tool}_{label}_list.png")
    assert hit, f"{tool}/{label}: option is covered by another layer"
    chosen = (await target.inner_text()).strip()
    await target.click()
    status = page.get_by_role("status").filter(has_text="Přítomno")
    await expect(status).to_be_visible(timeout=10000)
    before = await status.inner_text()
    student = page.get_by_role("list", name="Přítomnost žáků").get_by_role("button").first
    await expect(student).to_be_visible()
    await student.click()
    after = await status.inner_text()
    await page.screenshot(path=f"{OUT}/{tool}_{label}_students.png")
    await student.click()  # restore
    a, b = [int(re.search(r"Přítomno (\d+)", s).group(1)) for s in (before, after)]
    assert b == a - 1, f"{tool}/{label}: {before} -> {after}"
    print(f"OK {tool}/{label}: {len(names)} visible-list options, chose '{chosen}', {before} -> {after}")

async def main():
    with open(os.path.expanduser("~/.cache/lovable-auth/session.json")) as f: m = json.load(f)
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await (await b.new_context(viewport={"width": 1390, "height": 900})).new_page()
        await page.goto("http://localhost:8080")
        await page.evaluate("([k,v])=>localStorage.setItem(k,v)", [m["storage_key"], json.dumps(m["session"])])
        for tool in ("Losování", "Skupiny"):
            await page.goto("http://localhost:8080/ucitel/nastroje")
            await page.get_by_role("button", name=tool).first.click(timeout=20000)
            await pick(page, "normal", tool)
            await page.get_by_role("button", name="Celá obrazovka").click()
            await page.wait_for_function("!!document.fullscreenElement")
            await pick(page, "fullscreen", tool)
        await b.close()

asyncio.run(main())

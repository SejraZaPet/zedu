"""Regression: wheel/touchpad and touch scrolling in Popover lists nested in Dialogs.

Run against the dev server with the injected preview session (or a minted session):
    python3 e2e/popover_dialog_wheel.py
The test changes only local React state; it does not save or send anything.
"""
import asyncio
import json
import os
import re
from pathlib import Path
from playwright.async_api import async_playwright, expect

OUT = Path("/tmp/browser/popover-dialog-wheel")
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"


def session_parts():
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies = json.loads(os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON") or "[]")
    if session_json:
        return storage_key, session_json, cookies
    with open(os.path.expanduser("~/.cache/lovable-auth/session.json")) as file:
        minted = json.load(file)
    return minted["storage_key"], json.dumps(minted["session"]), minted.get("cookies") or []


async def authenticate(page, context, storage_key, session_json, cookies):
    if cookies:
        await context.add_cookies([{**cookie, "url": BASE} for cookie in cookies])
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate("([key, value]) => localStorage.setItem(key, value)", [storage_key, session_json])


async def open_lesson_list(page, kind):
    await page.goto(f"{BASE}/student/metody", wait_until="domcontentloaded")
    if kind == "cards":
        await page.get_by_role("button", name=re.compile(r"^Chci si to zapamatovat")).click(timeout=20000)
    elif kind == "summary":
        await page.get_by_role("button", name=re.compile(r"^Shrnutí")).click(timeout=20000)
    else:
        await page.locator("#triky-na-uceni button").filter(has_text="Zobrazit návod").first.click(timeout=20000)
        await page.get_by_role("button", name="Procvičit", exact=True).click()
    await page.get_by_role("dialog").wait_for(state="visible")
    await page.get_by_role("combobox", name="Lekce pro studijní pomůcku").click()
    listbox = page.locator("[cmdk-list]")
    await listbox.wait_for(state="visible")
    await page.wait_for_timeout(250)
    return listbox


async def assert_wheel_scrolls(page, listbox):
    before = await listbox.evaluate("el => ({ top: el.scrollTop, height: el.clientHeight, full: el.scrollHeight })")
    assert before["full"] > before["height"], f"Test needs an overflowing lesson list: {before}"
    box = await listbox.bounding_box()
    assert box
    await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + min(100, box["height"] / 2))
    await page.mouse.wheel(0, 500)
    await page.wait_for_timeout(400)
    after = await listbox.evaluate("el => el.scrollTop")
    assert after > before["top"], f"Wheel did not scroll: {before['top']} -> {after}"
    print(f"OK wheel: {before['top']} -> {after}")


async def assert_touch_scrolls(page, listbox):
    before = await listbox.evaluate("el => el.scrollTop")
    box = await listbox.bounding_box()
    assert box
    x = box["x"] + box["width"] / 2
    start_y = box["y"] + box["height"] * 0.75
    end_y = box["y"] + box["height"] * 0.25
    cdp = await page.context.new_cdp_session(page)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": start_y}]})
    for step in range(1, 8):
        y = start_y + (end_y - start_y) * step / 7
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y}]})
        await page.wait_for_timeout(35)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    await page.wait_for_timeout(500)
    after = await listbox.evaluate("el => el.scrollTop")
    assert after > before, f"Touch did not scroll: {before} -> {after}"
    print(f"OK touch 390px: {before} -> {after}")


async def main():
    storage_key, session_json, cookies = session_parts()
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()
        await authenticate(page, context, storage_key, session_json, cookies)
        for kind in ("cards", "summary", "method"):
            listbox = await open_lesson_list(page, kind)
            await assert_wheel_scrolls(page, listbox)
            trigger = page.get_by_role("combobox", name="Lekce pro studijní pomůcku")
            if kind == "cards":
                outside = page.locator("h2").filter(has_text="Chci si to zapamatovat")
                outside_box = await outside.bounding_box()
                assert outside_box
                await page.mouse.click(outside_box["x"] + 20, outside_box["y"] + outside_box["height"] / 2)
                await expect(trigger).to_have_attribute("aria-expanded", "false")
                await expect(page.get_by_role("dialog")).to_be_visible()
                await trigger.click()
                await page.keyboard.press("ArrowDown")
                await page.keyboard.press("Enter")
                await expect(trigger).to_have_attribute("aria-expanded", "false")
                await expect(trigger).to_be_focused()
                print("OK outside click, keyboard selection and focus restoration")
            else:
                await page.keyboard.press("Escape")
                await expect(trigger).to_have_attribute("aria-expanded", "false")
                await expect(page.get_by_role("dialog")).to_be_visible()
                print(f"OK {kind}: Escape closes only the popover")
        await page.screenshot(path=str(OUT / "desktop_after_fix.png"))
        await context.close()

        mobile = await browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        page = await mobile.new_page()
        await authenticate(page, mobile, storage_key, session_json, cookies)
        listbox = await open_lesson_list(page, "cards")
        await assert_touch_scrolls(page, listbox)
        assert await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Horizontal overflow at 390px"
        await page.screenshot(path=str(OUT / "mobile_touch_after_fix.png"))
        await browser.close()


asyncio.run(main())

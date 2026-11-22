"""Layout regression for the mobile-remote QR dialog at desktop and phone widths.

Run against the dev server:
    python3 e2e/remote_control_dialog_layout.py

The real component is rendered locally with a fake session ID. No authentication,
backend query, database write or persistent test data is involved.
"""
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/remote-control-dialog-layout")
OUT.mkdir(parents=True, exist_ok=True)


async def render_remote_dialog(page):
    await page.goto(BASE, wait_until="domcontentloaded")
    result = await page.evaluate(
        """async () => {
          try {
            const ReactModule = await import('/node_modules/.vite/deps/react.js');
            const React = ReactModule.default || ReactModule;
            const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
            const createRoot = ReactDOM.createRoot || ReactDOM.default.createRoot;
            const { default: RemoteControlButton } = await import('/src/components/live/RemoteControlButton.tsx');
            const host = document.createElement('div');
            host.id = 'remote-control-layout-test';
            document.body.appendChild(host);
            createRoot(host).render(React.createElement(RemoteControlButton, {
              sessionId: 'layout-test-with-a-long-session-identifier',
            }));
            return null;
          } catch (error) {
            return String(error?.stack || error);
          }
        }"""
    )
    assert result is None, result
    await page.get_by_role("button", name="Ovládání z mobilu", exact=True).click()
    dialog = page.get_by_role("dialog")
    await dialog.wait_for(state="visible")
    await page.wait_for_timeout(250)
    return dialog


async def assert_layout(page, width):
    dialog = page.get_by_role("dialog")
    metrics = await dialog.evaluate(
        """dialog => {
          const rect = dialog.getBoundingClientRect();
          const description = dialog.querySelector('p');
          const descriptionStyle = getComputedStyle(description);
          const descriptionRect = description.getBoundingClientRect();
          const code = dialog.querySelector('code');
          const copyButton = dialog.querySelector('button[aria-label="Kopírovat odkaz"]');
          const qr = dialog.querySelector('svg').getBoundingClientRect();
          const offenders = [dialog, ...dialog.querySelectorAll('*')].map(element => {
            const box = element.getBoundingClientRect();
            return { tag: element.tagName, left: box.left, right: box.right };
          }).filter(box => box.left < rect.left - 1 || box.right > rect.right + 1);
          return {
            viewportWidth: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            dialogLeft: rect.left,
            dialogRight: rect.right,
            dialogClientWidth: dialog.clientWidth,
            dialogScrollWidth: dialog.scrollWidth,
            descriptionHeight: descriptionRect.height,
            descriptionLineHeight: parseFloat(descriptionStyle.lineHeight),
            descriptionWhiteSpace: descriptionStyle.whiteSpace,
            codeClientWidth: code.clientWidth,
            codeScrollWidth: code.scrollWidth,
            codeTextOverflow: getComputedStyle(code).textOverflow,
            copyButtonWidth: copyButton.getBoundingClientRect().width,
            qrCenter: (qr.left + qr.right) / 2,
            dialogCenter: (rect.left + rect.right) / 2,
            offenders,
          };
        }"""
    )
    assert metrics["viewportWidth"] == width
    assert metrics["documentWidth"] <= width, metrics
    assert metrics["dialogLeft"] >= 0 and metrics["dialogRight"] <= width, metrics
    assert metrics["dialogClientWidth"] <= 384, metrics
    assert metrics["dialogScrollWidth"] <= metrics["dialogClientWidth"] + 1, metrics
    assert not metrics["offenders"], metrics
    assert metrics["descriptionWhiteSpace"] == "normal", metrics
    assert metrics["descriptionHeight"] > metrics["descriptionLineHeight"] * 1.5, metrics
    assert metrics["codeTextOverflow"] == "ellipsis", metrics
    assert metrics["codeScrollWidth"] > metrics["codeClientWidth"], metrics
    assert metrics["copyButtonWidth"] >= 40, metrics
    assert abs(metrics["qrCenter"] - metrics["dialogCenter"]) <= 1, metrics
    await page.get_by_role("button", name="Kopírovat odkaz", exact=True).wait_for(state="visible")
    await page.screenshot(path=str(OUT / f"dialog_{width}.png"))
    print(f"OK {width}px: " + json.dumps({
        "dialog": metrics["dialogClientWidth"],
        "scroll": metrics["dialogScrollWidth"],
        "description_lines": round(metrics["descriptionHeight"] / metrics["descriptionLineHeight"]),
        "qr_center_delta": round(abs(metrics["qrCenter"] - metrics["dialogCenter"]), 2),
    }))


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        for width in (1366, 390):
            context = await browser.new_context(
                viewport={"width": width, "height": 900 if width == 1366 else 844},
                has_touch=width == 390,
                is_mobile=width == 390,
            )
            page = await context.new_page()
            await render_remote_dialog(page)
            await assert_layout(page, width)
            await context.close()
        await browser.close()


asyncio.run(main())

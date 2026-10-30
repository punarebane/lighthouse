import { expect, test, type Page } from '@playwright/test';

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('autoplay run survives 30s and reaches level 3', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/?seed=1&autoplay=1');
  await page.waitForFunction(() => window.__LH && window.__LH.frames > 5);
  await page.screenshot({ path: 'screenshots/smoke-start.png' });
  await page.waitForTimeout(30_000);
  const s = await page.evaluate(() => window.__LH);
  await page.screenshot({ path: 'screenshots/smoke-30s.png' });
  expect(s.running).toBe(true);
  expect(s.mode).toBe('playing');
  expect(s.level).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('main menu, shop, settings and a manual run with a level-up card', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/?seed=2');
  await expect(page.locator('.title')).toHaveText('LIGHTHOUSE');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/menu.png' });
  await page.getByRole('button', { name: "Keeper's upgrades" }).click();
  await expect(page.locator('.shop-row')).toHaveCount(8);
  await page.screenshot({ path: 'screenshots/shop.png' });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.screenshot({ path: 'screenshots/settings.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Light the lamp' }).click();
  // aim the beam with the mouse in a slow circle until the first level-up card appears
  const box = page.viewportSize()!;
  for (let k = 0; k < 400; k++) {
    const a = k * 0.15;
    await page.mouse.move(box.width / 2 + Math.cos(a) * 200, box.height / 2 + Math.sin(a) * 200);
    await page.waitForTimeout(100);
    if (await page.locator('.card').count()) break;
  }
  await expect(page.locator('.card').first()).toBeVisible();
  await page.screenshot({ path: 'screenshots/levelup.png' });
  await page.keyboard.press('1');
  await expect(page.locator('.card')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Let the light go out' }).click();
  await expect(page.locator('.summary')).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'screenshots/summary.png' });
  expect(errors).toEqual([]);
});

test('bench mode reports frame stats', async ({ page }) => {
  test.setTimeout(90_000);
  const logs: string[] = [];
  page.on('console', (m) => { if (m.text().startsWith('[bench]')) logs.push(m.text()); });
  await page.goto('/?bench=5000&seed=1');
  await page.waitForFunction(() => window.__LH && window.__LH.bench !== null, null, { timeout: 80_000 });
  const b = (await page.evaluate(() => window.__LH.bench))!;
  await page.screenshot({ path: 'screenshots/bench-5000.png' });
  expect(b.enemies).toBeGreaterThanOrEqual(4900);
  expect(logs.length).toBe(1);
  console.log(logs[0]);
});

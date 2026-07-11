import { expect, test } from '@playwright/test';

const currentUser = {
  id: 'a0d41b34-c429-49b0-b27a-f6c754ce6ac9',
  email: 'analyst@example.com',
  role: 'user',
  createdAt: '2026-07-11T00:00:00.000Z',
};

let consoleProblems: string[];

test.beforeEach(({ page }) => {
  consoleProblems = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => consoleProblems.push(error.message));

  test.info().annotations.push({
    type: 'console-check',
    description: 'Console errors and warnings are asserted after rendering.',
  });

});

test('renders a focused login experience', async ({ page }, testInfo) => {
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or expired',
        },
      }),
    });
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: '登录工作区' })).toBeVisible();
  await expect(page.getByLabel('工作邮箱')).toBeFocused();
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(consoleProblems).toEqual([
    'error: Failed to load resource: the server responded with a status of 401 (Unauthorized)',
  ]);
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
});

test('restores the protected workbench', async ({ page }, testInfo) => {
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'browser-access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      }),
    });
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    expect(route.request().headers().authorization).toBe(
      'Bearer browser-access-token',
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentUser),
    });
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: '知识工作台' })).toBeVisible();
  await expect(
    page.locator('.status-list dd').filter({ hasText: currentUser.email }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(consoleProblems).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('workbench.png'),
    fullPage: true,
  });
});

async function expectNoHorizontalOverflow(
  page: import('@playwright/test').Page,
): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

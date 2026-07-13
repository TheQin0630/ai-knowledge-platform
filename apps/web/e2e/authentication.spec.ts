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
  await page.route('**/api/v1/workspaces', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: '知识工作台' })).toBeVisible();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(consoleProblems).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('workbench.png'),
    fullPage: true,
  });
});

test('switches workspaces and creates a knowledge base', async ({ page }, testInfo) => {
  const platformWorkspace = {
    id: '859ce7a0-4f96-4786-a9f6-3ec74c1d1477',
    name: '平台工程',
    role: 'owner',
    knowledgeBaseCount: 1,
    createdAt: '2026-07-13T00:00:00.000Z',
  };
  const customerWorkspace = {
    id: 'a6e9c302-d657-4d5b-85bd-3c95e3d8f8b1',
    name: '客户成功',
    role: 'admin',
    knowledgeBaseCount: 0,
    createdAt: '2026-07-13T01:00:00.000Z',
  };
  const workspaces = [platformWorkspace, customerWorkspace];
  const knowledgeBases = new Map<string, Array<Record<string, unknown>>>([
    [
      platformWorkspace.id,
      [
        {
          id: '2ad83cea-d755-48da-bfa4-054eaabac4c6',
          workspaceId: platformWorkspace.id,
          name: '架构决策',
          description: '已验证的技术决策',
          createdAt: '2026-07-13T02:00:00.000Z',
          updatedAt: '2026-07-13T02:00:00.000Z',
        },
      ],
    ],
    [customerWorkspace.id, []],
  ]);

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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentUser),
    });
  });
  await page.route('**/api/v1/workspaces', async (route) => {
    expect(route.request().headers().authorization).toBe(
      'Bearer browser-access-token',
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(workspaces),
    });
  });
  await page.route('**/api/v1/workspaces/*/knowledge-bases', async (route) => {
    const request = route.request();
    expect(request.headers().authorization).toBe('Bearer browser-access-token');
    const workspaceId = new URL(request.url()).pathname.split('/')[4];
    if (!workspaceId) throw new Error('Expected workspace id in request path');
    if (request.method() === 'POST') {
      const input = request.postDataJSON() as { name: string; description?: string };
      const item = {
        id: '07830151-429b-4d82-8542-f6ad4c707bdd',
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        createdAt: '2026-07-13T03:00:00.000Z',
        updatedAt: '2026-07-13T03:00:00.000Z',
      };
      knowledgeBases.get(workspaceId)?.push(item);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(item) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(knowledgeBases.get(workspaceId) ?? []),
    });
  });

  await page.goto('/');

  await expect(page).toHaveURL(
    new RegExp(`/workspaces/${platformWorkspace.id}$`),
  );
  await expect(page.getByRole('heading', { name: '平台工程' })).toBeVisible();
  await expect(page.getByText('架构决策')).toBeVisible();
  await page.getByLabel('Workspace').selectOption(customerWorkspace.id);
  await expect(page.getByRole('heading', { name: '客户成功' })).toBeVisible();
  await page.getByRole('button', { name: '新建知识库' }).click();
  await page.getByLabel('知识库名称').fill('客户手册');
  await page.getByLabel('描述（可选）').fill('客户成功团队的交付资料');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(page.getByText('客户手册')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(consoleProblems).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('knowledge-workspace.png'),
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

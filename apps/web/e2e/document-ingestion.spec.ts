import { expect, test } from '@playwright/test';

const workspaceId = '859ce7a0-4f96-4786-a9f6-3ec74c1d1477';
const knowledgeBaseId = '2ad83cea-d755-48da-bfa4-054eaabac4c6';
const documentId = '8c748530-7935-48f6-9b41-f8f67845db08';
const versionId = 'cd9b4f37-5ac9-43f2-b2df-cf48c6b547aa';

test('shows document status, detail and retry without overflow', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  let retried = false;
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(message.text());
  });
  page.on('pageerror', (error) => consoleProblems.push(error.message));
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'browser-token', tokenType: 'Bearer', expiresIn: 900 }) }));
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'a0d41b34-c429-49b0-b27a-f6c754ce6ac9', email: 'owner@example.com', role: 'user' }) }));
  await page.route('**/api/v1/workspaces', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: workspaceId, name: '平台工程', role: 'owner', knowledgeBaseCount: 1, createdAt: '2026-07-13T00:00:00.000Z' }]) }));
  await page.route(`**/api/v1/workspaces/${workspaceId}/knowledge-bases`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: knowledgeBaseId, workspaceId, name: '运维手册', description: '生产运行手册', createdAt: '2026-07-13T00:00:00.000Z', updatedAt: '2026-07-13T00:00:00.000Z' }]) }));
  const version = () => ({ id: versionId, versionNumber: 1, mediaType: 'text/markdown', sizeBytes: 4096, status: retried ? 'queued' : 'failed', attemptCount: 3, errorCode: retried ? null : 'DOCUMENT_PARSE_FAILED', errorMessage: retried ? null : '文档中没有可提取文本', createdAt: '2026-07-13T00:00:00.000Z', updatedAt: '2026-07-13T00:00:00.000Z' });
  const document = () => ({ id: documentId, knowledgeBaseId, fileName: 'incident-response.md', createdAt: '2026-07-13T00:00:00.000Z', updatedAt: '2026-07-13T00:00:00.000Z', latestVersion: version() });
  await page.route(`**/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/documents`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([document()]) }));
  await page.route(`**/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...document(), versions: [version()] }) }));
  await page.route(`**/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/versions/${versionId}/retry`, async (route) => {
    retried = true;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(version()) });
  });

  await page.goto(`/workspaces/${workspaceId}`);
  await page.getByRole('button', { name: /运维手册/ }).click();
  await expect(page.getByRole('heading', { name: '运维手册' })).toBeVisible();
  await page.getByRole('button', { name: /incident-response.md/ }).click();
  await expect(page.getByText('文档中没有可提取文本')).toBeVisible();
  await page.getByRole('button', { name: '重新解析' }).click();
  await expect.poll(() => retried).toBe(true);
  await expectNoHorizontalOverflow(page);
  expect(consoleProblems).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('document-ingestion.png'), fullPage: true });
});

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

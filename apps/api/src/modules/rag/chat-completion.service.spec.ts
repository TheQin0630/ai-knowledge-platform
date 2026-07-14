import { ConfigService } from '@nestjs/config';
import { ChatCompletionService } from './chat-completion.service';

describe('ChatCompletionService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fails explicitly when no provider is configured', async () => {
    await expect(
      new ChatCompletionService(config({})).answer('system', 'question'),
    ).rejects.toMatchObject({
      response: { error: { code: 'CHAT_PROVIDER_UNAVAILABLE' } },
    });
  });

  it('validates an OpenAI-compatible structured answer', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answer: '答案',
                  citations: ['S1', 'S1'],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const service = new ChatCompletionService(
      config({
        CHAT_BASE_URL: 'http://chat.test/v1',
        CHAT_MODEL: 'test-model',
      }),
    );
    await expect(service.answer('system', 'question')).resolves.toEqual({
      answer: '答案',
      citationIds: ['S1'],
      model: 'custom/test-model',
    });
  });

  it('rejects malformed provider output', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'plain text' } }] }),
          { status: 200 },
        ),
      );
    await expect(
      new ChatCompletionService(
        config({ CHAT_BASE_URL: 'http://chat.test/v1' }),
      ).answer('system', 'question'),
    ).rejects.toMatchObject({
      response: { error: { code: 'CHAT_PROVIDER_UNAVAILABLE' } },
    });
  });

  it('uses a configured provider selected by the question request', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answer: 'GLM answer',
                  citations: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const service = new ChatCompletionService(
      config({
        CHAT_PROVIDER: 'deepseek',
        DEEPSEEK_API_KEY: 'deepseek',
        GLM_API_KEY: 'glm-secret',
      }),
    );
    await expect(
      service.answer('system', 'question', {
        provider: 'glm',
        model: 'glm-debug',
      }),
    ).resolves.toMatchObject({ model: 'glm/glm-debug' });
    const [url, request] = jest.mocked(global.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions');
    expect(request?.headers).toMatchObject({
      authorization: 'Bearer glm-secret',
    });
  });
});

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

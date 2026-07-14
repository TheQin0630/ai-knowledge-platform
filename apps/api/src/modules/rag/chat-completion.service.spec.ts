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
      model: 'test-model',
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
});

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

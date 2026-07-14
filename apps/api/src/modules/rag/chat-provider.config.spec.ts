import { ConfigService } from '@nestjs/config';
import { resolveChatProvider } from './chat-provider.config';

describe('resolveChatProvider', () => {
  it.each([
    ['glm', 'https://open.bigmodel.cn/api/paas/v4', 'GLM_API_KEY'],
    ['deepseek', 'https://api.deepseek.com', 'DEEPSEEK_API_KEY'],
    [
      'qwen',
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      'DASHSCOPE_API_KEY',
    ],
    ['ollama', 'http://host.docker.internal:11434/v1', undefined],
  ])('resolves the %s preset', (provider, baseUrl, keyName) => {
    const values: Record<string, string> = {
      CHAT_PROVIDER: provider,
      CHAT_MODEL: 'test-model',
    };
    if (keyName) values[keyName] = 'secret';
    expect(resolveChatProvider(config(values))).toEqual({
      provider,
      baseUrl,
      model: 'test-model',
      ...(keyName ? { apiKey: 'secret' } : {}),
    });
  });

  it('keeps legacy custom endpoint configuration compatible', () => {
    expect(
      resolveChatProvider(
        config({
          CHAT_BASE_URL: 'http://custom.test/v1',
          CHAT_MODEL: 'custom',
          CHAT_API_KEY: 'key',
        }),
      ),
    ).toEqual({
      provider: 'custom',
      baseUrl: 'http://custom.test/v1',
      model: 'custom',
      apiKey: 'key',
    });
  });
});

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

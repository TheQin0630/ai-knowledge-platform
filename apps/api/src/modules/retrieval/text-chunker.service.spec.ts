import { TextChunkerService } from './text-chunker.service';

describe('TextChunkerService', () => {
  const chunker = new TextChunkerService();

  it('keeps a short document as one searchable chunk', () => {
    expect(chunker.split('第一段知识。\n\n第二段补充。')).toEqual([
      {
        index: 0,
        content: '第一段知识。\n\n第二段补充。',
        startOffset: 0,
        endOffset: 14,
      },
    ]);
  });

  it('splits long text with deterministic overlap and offsets', () => {
    const text = `${'甲'.repeat(700)}\n\n${'乙'.repeat(300)}`;
    const chunks = chunker.split(text);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      index: 0,
      startOffset: 0,
      endOffset: 700,
    });
    expect(chunks[1].index).toBe(1);
    expect(chunks[1].startOffset).toBeLessThan(chunks[0].endOffset);
    expect(chunks[1].content).toContain('乙'.repeat(300));
  });

  it('rejects empty extracted text', () => {
    expect(() => chunker.split('  \n\n ')).toThrow('Cannot chunk empty text');
  });
});

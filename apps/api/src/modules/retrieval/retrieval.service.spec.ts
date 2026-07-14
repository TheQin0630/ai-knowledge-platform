import { reciprocalRankFusion } from './retrieval.service';

describe('reciprocalRankFusion', () => {
  it('promotes chunks found by both keyword and vector retrieval', () => {
    const results = reciprocalRankFusion(
      [
        { chunkId: 'keyword-only', rank: 1 },
        { chunkId: 'both', rank: 2 },
      ],
      [
        { chunkId: 'vector-only', rank: 1 },
        { chunkId: 'both', rank: 2 },
      ],
      10,
    );

    expect(results[0]).toMatchObject({
      chunkId: 'both',
      keywordRank: 2,
      vectorRank: 2,
    });
  });

  it('returns deterministic ordering when scores tie', () => {
    const results = reciprocalRankFusion(
      [{ chunkId: 'b', rank: 1 }],
      [{ chunkId: 'a', rank: 1 }],
      10,
    );

    expect(results.map(({ chunkId }) => chunkId)).toEqual(['a', 'b']);
  });
});

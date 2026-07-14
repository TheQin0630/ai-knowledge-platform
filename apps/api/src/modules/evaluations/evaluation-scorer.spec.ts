import { scoreEvaluationCase } from './evaluation-scorer';

describe('scoreEvaluationCase', () => {
  it('calculates keyword coverage and citation source accuracy deterministically', () => {
    expect(
      scoreEvaluationCase(
        {
          answer: '应先备份，然后执行回滚。',
          citations: [{ fileName: '运维手册.md' }],
        },
        ['备份', '回滚'],
        ['运维手册.md'],
      ),
    ).toEqual({ keywordCoverage: 1, citationCoverage: 1, grounded: true });
  });

  it('does not treat an uncited answer as grounded', () => {
    expect(
      scoreEvaluationCase(
        { answer: '猜测答案', citations: [] },
        ['答案'],
        ['制度.md'],
      ),
    ).toEqual({ keywordCoverage: 1, citationCoverage: 0, grounded: false });
  });
});

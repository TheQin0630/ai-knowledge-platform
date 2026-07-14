export interface ScorableAnswer {
  answer: string;
  citations: Array<{ fileName: string }>;
}

export function scoreEvaluationCase(
  answer: ScorableAnswer,
  keywords: string[],
  files: string[],
) {
  const normalizedAnswer = answer.answer.toLocaleLowerCase();
  const matchedKeywords = keywords.filter((keyword) =>
    normalizedAnswer.includes(keyword.toLocaleLowerCase()),
  ).length;
  const citedFiles = new Set(
    answer.citations.map((citation) => citation.fileName.toLocaleLowerCase()),
  );
  const matchedFiles = files.filter((file) =>
    citedFiles.has(file.toLocaleLowerCase()),
  ).length;
  return {
    keywordCoverage: ratio(matchedKeywords, keywords.length),
    citationCoverage: ratio(matchedFiles, files.length),
    grounded: answer.citations.length > 0,
  };
}

function ratio(matched: number, total: number): number {
  return total === 0 ? 1 : Number((matched / total).toFixed(4));
}

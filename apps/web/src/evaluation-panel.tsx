import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Play } from 'lucide-react';
import { FormEvent, useEffect } from 'react';
import { ApiError } from './api/auth-client';
import { evaluationClient } from './api/evaluation-client';
import './evaluation-panel.css';

export function EvaluationPanel({ accessToken, workspaceId, knowledgeBaseId, onSessionExpired }: {
  accessToken: string; workspaceId: string; knowledgeBaseId: string; onSessionExpired: () => void;
}) {
  const client = useQueryClient();
  const key = ['evaluations', workspaceId, knowledgeBaseId];
  const runs = useQuery({ queryKey: key, queryFn: () => evaluationClient.list(accessToken, workspaceId, knowledgeBaseId) });
  const run = useMutation({ mutationFn: evaluationClient.run.bind(null, accessToken, workspaceId, knowledgeBaseId),
    onSuccess: () => client.invalidateQueries({ queryKey: key }) });
  useEffect(() => { if ([runs.error, run.error].some((error) => error instanceof ApiError && error.status === 401)) onSessionExpired(); },
    [onSessionExpired, run.error, runs.error]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = data.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const list = (key: string) => text(key).split(',').map((item) => item.trim()).filter(Boolean);
    run.mutate({ name: text('name'), cases: [{ question: text('question'), expectedKeywords: list('keywords'), expectedFiles: list('files') }] });
  }
  return <section className="evaluation-section" aria-labelledby="evaluation-title">
    <header><div><p className="section-kicker">EVALUATION</p><h2 id="evaluation-title">效果评测与版本对比</h2>
      <p>用固定问题、答案关键词和预期来源生成可复现的质量基线。</p></div><BarChart3 /></header>
    <form onSubmit={submit}><input name="name" aria-label="评测名称" placeholder="评测名称" maxLength={120} required />
      <textarea name="question" aria-label="评测问题" placeholder="评测问题" minLength={2} required />
      <input name="keywords" aria-label="答案关键词" placeholder="答案关键词，用逗号分隔" required />
      <input name="files" aria-label="预期引用文件" placeholder="预期引用文件，用逗号分隔" required />
      <button className="primary-button" disabled={run.isPending}><Play size={15} />{run.isPending ? '运行中…' : '运行评测'}</button></form>
    {run.isError ? <p className="evaluation-error" role="alert">评测未完成，请检查模型配置和知识库内容。</p> : null}
    {runs.data?.length ? <div className="evaluation-table" role="table"><div role="row" className="evaluation-head">
      <span>运行</span><span>关键词</span><span>引用</span><span>有依据</span></div>{runs.data.map((item) => <div role="row" key={item.id}>
        <span><strong>{item.name}</strong><small>{item.retrievalVersion} · {item.caseCount} 题</small></span>
        <span>{percent(item.keywordCoverage)}</span><span>{percent(item.citationCoverage)}</span><span>{percent(item.groundedRate)}</span>
      </div>)}</div> : <p className="evaluation-empty">尚无评测运行。建立第一条基线后即可比较后续检索或模型版本。</p>}
  </section>;
}

function percent(value: number | string) { return `${Math.round(Number(value) * 100)}%`; }

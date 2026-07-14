import { useMutation } from '@tanstack/react-query';
import { Search, Sparkles } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from './api/auth-client';
import { retrievalClient } from './api/retrieval-client';
import './retrieval-panel.css';

interface RetrievalPanelProps {
  accessToken: string;
  workspaceId: string;
  knowledgeBaseId: string;
  onSessionExpired: () => void;
}

export function RetrievalPanel({
  accessToken,
  workspaceId,
  knowledgeBaseId,
  onSessionExpired,
}: RetrievalPanelProps) {
  const [query, setQuery] = useState('');
  const search = useMutation({
    mutationFn: (value: string) =>
      retrievalClient.search(accessToken, workspaceId, knowledgeBaseId, value),
  });

  useEffect(() => {
    if (search.error instanceof ApiError && search.error.status === 401) {
      onSessionExpired();
    }
  }, [onSessionExpired, search.error]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length >= 2) search.mutate(normalized);
  }

  return (
    <section className="retrieval-section" aria-labelledby="retrieval-title">
      <header className="retrieval-heading">
        <div>
          <p className="section-kicker">RETRIEVAL LAB</p>
          <h2 id="retrieval-title">检索调试</h2>
          <p>验证知识片段的召回结果、来源版本和排序信号。</p>
        </div>
        {search.data ? (
          <span className={`retrieval-mode ${search.data.mode}`}>
            {search.data.mode === 'hybrid' ? <Sparkles size={14} /> : <Search size={14} />}
            {search.data.mode === 'hybrid' ? '混合检索' : '关键词检索'}
          </span>
        ) : null}
      </header>

      <form className="retrieval-form" onSubmit={submit}>
        <label htmlFor="retrieval-query">检索问题</label>
        <div>
          <input
            id="retrieval-query"
            value={query}
            minLength={2}
            maxLength={2000}
            placeholder="例如：生产环境如何回滚？"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="primary-button" disabled={search.isPending || query.trim().length < 2}>
            <Search size={16} />{search.isPending ? '检索中…' : '开始检索'}
          </button>
        </div>
      </form>

      {search.isError ? (
        <p className="retrieval-error" role="alert">检索暂时不可用，请稍后重试。</p>
      ) : null}
      {search.data?.mode === 'keyword' ? (
        <p className="retrieval-notice">当前使用关键词召回；配置嵌入模型后会自动启用向量混合排序。</p>
      ) : null}
      {search.data && search.data.results.length === 0 ? (
        <div className="retrieval-empty">没有找到相关片段，请尝试更具体的关键词。</div>
      ) : null}
      {search.data?.results.length ? (
        <ol className="retrieval-results">
          {search.data.results.map((hit, index) => (
            <li key={hit.chunkId}>
              <div className="retrieval-rank">{String(index + 1).padStart(2, '0')}</div>
              <article>
                <header>
                  <strong>{hit.fileName} · 版本 {hit.versionNumber}</strong>
                  <span>{rankLabel(hit.keywordRank, hit.vectorRank)}</span>
                </header>
                <p>{hit.content}</p>
              </article>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function rankLabel(keywordRank: number | null, vectorRank: number | null): string {
  const labels = [];
  if (keywordRank) labels.push(`关键词 #${keywordRank}`);
  if (vectorRank) labels.push(`向量 #${vectorRank}`);
  return labels.join(' · ');
}

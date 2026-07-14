import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Send } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from './api/auth-client';
import { ragClient } from './api/rag-client';
import './rag-panel.css';

export function RagPanel({ accessToken, workspaceId, knowledgeBaseId, onSessionExpired }: {
  accessToken: string; workspaceId: string; knowledgeBaseId: string; onSessionExpired: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const models = useQuery({ queryKey: ['chat-models'], queryFn: () => ragClient.models(accessToken, workspaceId, knowledgeBaseId) });
  useEffect(() => { const first = models.data?.[0]; if (first && !provider) { setProvider(first.id); setModel(first.defaultModel); } }, [models.data, provider]);
  const ask = useMutation({ mutationFn: (value: string) => ragClient.ask(accessToken, workspaceId, knowledgeBaseId, value,
    { ...(provider ? { provider } : {}), ...(model ? { model } : {}) }) });
  useEffect(() => {
    if (ask.error instanceof ApiError && ask.error.status === 401) onSessionExpired();
  }, [ask.error, onSessionExpired]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (value.length >= 2) ask.mutate(value);
  }
  const unavailable = ask.error instanceof ApiError && ask.error.code === 'CHAT_PROVIDER_UNAVAILABLE';
  return <section className="rag-section" aria-labelledby="rag-title">
    <header><div><p className="section-kicker">RAG WORKBENCH</p><h2 id="rag-title">知识库问答</h2>
      <p>回答严格基于已解析的知识片段，并保留可核验的文档引用。</p></div><Bot aria-hidden="true" /></header>
    <form onSubmit={submit}><div className="rag-model-row"><label>模型源<select aria-label="模型源" value={provider}
      onChange={(event) => { const next = models.data?.find((item) => item.id === event.target.value); setProvider(event.target.value); setModel(next?.defaultModel ?? ''); }}>
      {models.data?.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>模型<input aria-label="模型名称" value={model} maxLength={150} onChange={(event) => setModel(event.target.value)} /></label></div>
      <label htmlFor="rag-question">你的问题</label><div>
      <textarea id="rag-question" value={question} minLength={2} maxLength={4000}
        placeholder="例如：生产环境发生故障时应该如何回滚？" onChange={(event) => setQuestion(event.target.value)} />
      <button className="primary-button" disabled={ask.isPending || question.trim().length < 2}>
        <Send size={16} />{ask.isPending ? '生成中…' : '提问'}</button></div></form>
    {ask.isError ? <p className="rag-error" role="alert">{unavailable
      ? '尚未配置大模型服务。可设置 CHAT_PROVIDER 为 glm、openai、deepseek、qwen 或 ollama，并配置对应密钥后重启 API。'
      : '问答服务暂时不可用，请稍后重试。'}</p> : null}
    {ask.data ? <article className="rag-answer"><p>{ask.data.answer}</p>
      {ask.data.citations.length ? <ol>{ask.data.citations.map((citation) => <li key={citation.index}>
        <strong>[{citation.index}] {citation.fileName} · 版本 {citation.versionNumber}</strong><p>{citation.content}</p>
      </li>)}</ol> : <small>本次回答没有可引用的知识片段。</small>}
    </article> : null}
  </section>;
}

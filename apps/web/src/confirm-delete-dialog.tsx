import { FormEvent, useState } from 'react';
import { Trash2, X } from 'lucide-react';

export function ConfirmDeleteDialog({ resourceLabel, resourceName, pending, error, onClose, onConfirm }: {
  resourceLabel: string; resourceName: string; pending: boolean; error?: string; onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [value, setValue] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (value === resourceName) onConfirm(value); }
  return <div className="modal-backdrop"><section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
    <header><div><p className="section-kicker">PERMANENT DELETE</p><h2 id="delete-title">删除{resourceLabel}</h2></div>
      <button className="icon-button" type="button" aria-label="关闭" onClick={onClose} disabled={pending}><X size={18} /></button></header>
    <p>此操作不可撤销。请输入 <strong>{resourceName}</strong> 以确认。</p>
    <form onSubmit={submit}><label htmlFor="delete-confirm-name">确认名称</label>
      <input id="delete-confirm-name" autoFocus value={value} onChange={(event) => setValue(event.target.value)} />
      {error ? <p className="delete-error" role="alert">{error}</p> : null}
      <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button>
        <button className="danger-button" disabled={pending || value !== resourceName}><Trash2 size={16} />{pending ? '删除中…' : '永久删除'}</button></div>
    </form></section></div>;
}

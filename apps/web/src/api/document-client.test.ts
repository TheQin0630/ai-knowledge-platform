import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentClient } from './document-client';

class FakeXMLHttpRequest {
  static nextStatus = 201;
  static nextBody = '{}';
  readonly upload = new EventTarget();
  readonly events = new EventTarget();
  status = 0;
  responseText = '';
  withCredentials = false;
  open = vi.fn();
  setRequestHeader = vi.fn();
  addEventListener(type: string, listener: EventListener) { this.events.addEventListener(type, listener); }
  send = vi.fn(() => {
    this.upload.dispatchEvent(Object.assign(new Event('progress'), { lengthComputable: true, loaded: 5, total: 10 }));
    this.status = FakeXMLHttpRequest.nextStatus;
    this.responseText = FakeXMLHttpRequest.nextBody;
    this.events.dispatchEvent(new Event('load'));
  });
}

describe('documentClient upload', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reports progress and returns the queued document', async () => {
    FakeXMLHttpRequest.nextStatus = 201;
    FakeXMLHttpRequest.nextBody = JSON.stringify({ id: 'document-1', latestVersion: { status: 'queued' } });
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
    const progress = vi.fn();
    const result = await documentClient.upload('token', 'workspace-1', 'knowledge-base-1', new File(['body'], 'runbook.txt'), progress);
    expect(progress).toHaveBeenCalledWith(50);
    expect(result).toMatchObject({ id: 'document-1', latestVersion: { status: 'queued' } });
  });
  it('normalizes upload error envelopes', async () => {
    FakeXMLHttpRequest.nextStatus = 400;
    FakeXMLHttpRequest.nextBody = JSON.stringify({ error: { code: 'DOCUMENT_CONTENT_INVALID' } });
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
    await expect(documentClient.upload('token', 'workspace-1', 'knowledge-base-1', new File(['body'], 'bad.txt'), vi.fn())).rejects.toMatchObject({ status: 400, code: 'DOCUMENT_CONTENT_INVALID' });
  });
});

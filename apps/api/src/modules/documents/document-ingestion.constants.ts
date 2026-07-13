export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');
export const DOCUMENT_QUEUE = Symbol('DOCUMENT_QUEUE');
export const DOCUMENT_QUEUE_NAME = 'document-ingestion';
export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024;

export const supportedDocumentTypes = new Map([
  ['.pdf', 'application/pdf'],
  [
    '.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  ['.txt', 'text/plain'],
  ['.md', 'text/markdown'],
  ['.markdown', 'text/markdown'],
]);

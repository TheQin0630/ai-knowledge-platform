import { decodeMultipartFileName } from './documents.service';

describe('decodeMultipartFileName', () => {
  it('decodes a UTF-8 Chinese filename exposed as Latin-1 by multipart parsing', () => {
    const expected = '西电_实习内容_v1.4.docx';
    const multipartName = Buffer.from(expected, 'utf8').toString('latin1');

    expect(decodeMultipartFileName(multipartName)).toBe(expected);
  });

  it('keeps ASCII filenames unchanged', () => {
    expect(decodeMultipartFileName('runbook-v1.4.docx')).toBe(
      'runbook-v1.4.docx',
    );
  });

  it('does not corrupt an already-correct Unicode filename', () => {
    expect(decodeMultipartFileName('西电_实习内容_v1.4.docx')).toBe(
      '西电_实习内容_v1.4.docx',
    );
  });
});

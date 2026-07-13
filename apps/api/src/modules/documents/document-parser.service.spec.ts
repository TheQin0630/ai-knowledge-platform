import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { DocumentParserService } from './document-parser.service';

jest.mock('mammoth', () => ({
  __esModule: true,
  default: { extractRawText: jest.fn() },
}));
jest.mock('pdf-parse', () => ({ PDFParse: jest.fn() }));

describe('DocumentParserService', () => {
  const service = new DocumentParserService();

  it('normalizes plain text and markdown', async () => {
    await expect(
      service.extract(Buffer.from(' heading\r\nbody '), 'text/markdown'),
    ).resolves.toBe('heading\nbody');
  });

  it('extracts DOCX text through mammoth', async () => {
    jest
      .mocked(mammoth.extractRawText)
      .mockResolvedValue({ value: 'docx body', messages: [] });
    await expect(
      service.extract(
        Buffer.from('PK'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).resolves.toBe('docx body');
  });

  it('extracts PDF text and always destroys the parser', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    jest.mocked(PDFParse).mockImplementation(
      () =>
        ({
          getText: jest.fn().mockResolvedValue({ text: 'pdf body' }),
          destroy,
        }) as never,
    );
    await expect(
      service.extract(Buffer.from('%PDF-'), 'application/pdf'),
    ).resolves.toBe('pdf body');
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('rejects documents without extractable text', async () => {
    await expect(
      service.extract(Buffer.from('   '), 'text/plain'),
    ).rejects.toThrow('no extractable text');
  });
});

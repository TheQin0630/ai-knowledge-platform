import { Injectable } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class DocumentParserService {
  async extract(buffer: Buffer, mediaType: string): Promise<string> {
    let text: string;
    if (mediaType === 'application/pdf') {
      const parser = new PDFParse({ data: buffer });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else if (
      mediaType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      text = (await mammoth.extractRawText({ buffer })).value;
    } else {
      text = buffer.toString('utf8');
    }
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) throw new Error('Document contains no extractable text');
    return normalized;
  }
}

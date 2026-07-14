import { Injectable } from '@nestjs/common';

export interface TextChunk {
  index: number;
  content: string;
  startOffset: number;
  endOffset: number;
}

const targetSize = 800;
const minimumSize = 400;
const overlapSize = 120;

@Injectable()
export class TextChunkerService {
  split(input: string): TextChunk[] {
    const text = input.trim();
    if (!text) throw new Error('Cannot chunk empty text');

    const chunks: TextChunk[] = [];
    let startOffset = 0;
    while (startOffset < text.length) {
      const endOffset = findEndOffset(text, startOffset);
      chunks.push({
        index: chunks.length,
        content: text.slice(startOffset, endOffset),
        startOffset,
        endOffset,
      });
      if (endOffset === text.length) break;
      startOffset = Math.max(startOffset + 1, endOffset - overlapSize);
    }
    return chunks;
  }
}

function findEndOffset(text: string, startOffset: number): number {
  const maximumEnd = Math.min(text.length, startOffset + targetSize);
  if (maximumEnd === text.length) return maximumEnd;
  const paragraphEnd = text.lastIndexOf('\n\n', maximumEnd);
  return paragraphEnd >= startOffset + minimumSize ? paragraphEnd : maximumEnd;
}

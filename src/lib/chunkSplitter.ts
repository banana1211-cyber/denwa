/**
 * 句読点ベースのチャンク分割
 * LLMストリームから最初の句読点でTTS生成を即開始するための分割ロジック
 */

const PUNCTUATION_PATTERN = /[。、！？!?,.\n]/;
const MIN_CHUNK_LENGTH = 10;

export function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let buffer = '';

  for (const char of text) {
    buffer += char;

    if (PUNCTUATION_PATTERN.test(char) && buffer.trim().length >= MIN_CHUNK_LENGTH) {
      chunks.push(buffer.trim());
      buffer = '';
    }
  }

  if (buffer.trim().length > 0) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

/**
 * ストリーミング中に逐次チャンクを検出するジェネレータ
 * 最初の句読点に到達した時点でチャンクをyieldする
 */
export async function* streamingChunkSplitter(
  stream: AsyncIterable<string>
): AsyncGenerator<string> {
  let buffer = '';

  for await (const token of stream) {
    buffer += token;

    const match = buffer.match(PUNCTUATION_PATTERN);
    if (match && match.index !== undefined) {
      const chunkEnd = match.index + 1;
      const chunk = buffer.slice(0, chunkEnd).trim();

      if (chunk.length >= MIN_CHUNK_LENGTH) {
        yield chunk;
        buffer = buffer.slice(chunkEnd);
      }
    }
  }

  if (buffer.trim().length > 0) {
    yield buffer.trim();
  }
}

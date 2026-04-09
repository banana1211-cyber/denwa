/**
 * 句読点ベースのチャンク分割
 *
 * 戦略:
 * - 初回チャンク: 最初の句読点（。！？、）が来た瞬間に即送信（応答速度最優先）
 * - 2チャンク目以降: 50〜200文字でまとめて区切り（チャンク数を抑制して効率化）
 */

const PUNCTUATION_PATTERN = /[。！？、]/;
const MIN_SUBSEQUENT_LENGTH = 50;
const MAX_SUBSEQUENT_LENGTH = 200;

/**
 * ストリーミング中に逐次チャンクを検出するジェネレータ
 * 初回は最初の句読点で即yield、2回目以降は50〜200文字単位
 */
export async function* streamingChunkSplitter(
  stream: AsyncIterable<string>
): AsyncGenerator<string> {
  let buffer = '';
  let isFirstChunk = true;

  for await (const token of stream) {
    buffer += token;

    if (isFirstChunk) {
      // 初回: 最初の句読点が来た瞬間に即送信（1秒未満の核心）
      const match = buffer.match(PUNCTUATION_PATTERN);
      if (match && match.index !== undefined) {
        const chunkEnd = match.index + 1;
        const chunk = buffer.slice(0, chunkEnd).trim();
        if (chunk.length > 0) {
          yield chunk;
          buffer = buffer.slice(chunkEnd);
          isFirstChunk = false;
        }
      }
    } else {
      // 2チャンク目以降: 50〜200文字でまとめて区切る
      if (buffer.length >= MIN_SUBSEQUENT_LENGTH) {
        const match = buffer.match(PUNCTUATION_PATTERN);
        if (match && match.index !== undefined) {
          const chunkEnd = match.index + 1;
          const chunk = buffer.slice(0, chunkEnd).trim();
          if (chunk.length > 0) {
            yield chunk;
            buffer = buffer.slice(chunkEnd);
          }
        } else if (buffer.length >= MAX_SUBSEQUENT_LENGTH) {
          // 句読点がなくても最大文字数で強制分割
          yield buffer.trim();
          buffer = '';
        }
      }
    }
  }

  // ストリーム終了時に残りを送信
  if (buffer.trim().length > 0) {
    yield buffer.trim();
  }
}

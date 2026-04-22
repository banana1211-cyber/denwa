/**
 * 音声再生キュー管理
 * TTS生成済み音声をシームレスに順番再生するキュー
 */

export class AudioQueue {
  private queue: ArrayBuffer[] = [];
  private isPlaying = false;
  private audioContext: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new AudioContext();
    }
  }

  /**
   * 音声データをキューに追加（Fire-and-Forget）
   * LLMストリームをブロックせず非同期でエンキュー
   */
  enqueue(audioBuffer: ArrayBuffer): void {
    this.queue.push(audioBuffer);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioData = this.queue.shift()!;

    try {
      await this.playAudioBuffer(audioData);
    } catch (err) {
      console.error('Audio playback error:', err);
    }

    this.playNext();
  }

  private playAudioBuffer(data: ArrayBuffer): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this.audioContext) {
        reject(new Error('AudioContext not available'));
        return;
      }

      try {
        const buffer = await this.audioContext.decodeAudioData(data.slice(0));
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.onended = () => resolve();
        source.start(0);
      } catch (err) {
        reject(err);
      }
    });
  }

  clear(): void {
    this.queue = [];
    this.isPlaying = false;
  }

  get pending(): number {
    return this.queue.length;
  }
}

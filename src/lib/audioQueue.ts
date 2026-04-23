/**
 * 音声再生キュー管理
 * TTS生成済み音声をシームレスに順番再生するキュー
 *
 * getModel を渡すと VRMモデルの speak() 経由でリップシンク付き再生を行う。
 * モデルが未ロードの場合は AudioContext で直接再生にフォールバックする。
 */

export interface SpeakableModel {
  speak(buffer: ArrayBuffer, screenplay: { expression: string; talk: { style: string; speakerX: number; speakerY: number; message: string } }): Promise<void>;
}

export class AudioQueue {
  private queue: ArrayBuffer[] = [];
  private isPlaying = false;
  private audioContext: AudioContext | null = null;
  private getModel: () => SpeakableModel | undefined;

  constructor(getModel?: () => SpeakableModel | undefined) {
    this.getModel = getModel ?? (() => undefined);
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
      const model = this.getModel();
      if (model) {
        // VRMモデルがロード済み → リップシンク付き再生
        await model.speak(audioData, {
          expression: 'neutral',
          talk: { style: 'talk', speakerX: 0, speakerY: 0, message: '' },
        });
      } else {
        // フォールバック: AudioContextで直接再生
        await this.playAudioBuffer(audioData);
      }
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

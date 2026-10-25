import type { SoundId } from '../../core/ids.ts';
import type { Registry } from '../../core/Registry.ts';
import { BGM } from '../../data/sounds.ts';
import type { ZzfxParams } from '../../shared/types.ts';
import { buildSamples, ZZFX_SAMPLE_RATE } from './zzfx.ts';

const MUTE_KEY = 'minitcatch.mute';
const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** SFX + procedural BGM via ZzFX sample buffers. AudioContext is created on first user gesture (resume()). */
export class ZzfxPlayer {
  private readonly sounds: Registry<SoundId, ZzfxParams>;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private muted = false;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly lastPlayed = new Map<string, number>();
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private ducked = false;

  constructor(sounds: Registry<SoundId, ZzfxParams>) {
    this.sounds = sounds;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage blocked: default unmuted */ }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  async resume(): Promise<void> {
    try {
      if (this.ctx === null) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor === undefined) return; // no audio support: silently degrade
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.connect(this.master);
        this.master.connect(this.ctx.destination);
        this.applyMute();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
    } catch (e) {
      console.warn('[ZzfxPlayer] audio resume failed/blocked:', e);
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    this.applyMute();
    return this.muted;
  }

  private applyMute(): void {
    try {
      if (this.master !== null && this.ctx !== null) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.01);
      }
    } catch {
      /* ignore audio context state issues */
    }
  }

  private toBuffer(key: string, params: ZzfxParams, rand?: () => number): AudioBuffer | null {
    if (this.ctx === null) return null;
    let buf = this.buffers.get(key);
    if (buf === undefined) {
      const samples = buildSamples(params, rand);
      buf = this.ctx.createBuffer(1, samples.length, ZZFX_SAMPLE_RATE);
      buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
      this.buffers.set(key, buf);
    }
    return buf;
  }

  /** Plays a registered SFX. Same sound is rate-limited to 40 ms to avoid stacking. */
  play(name: string, gain = 1): void {
    if (this.ctx === null || this.master === null || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < 0.04) return;
    this.lastPlayed.set(name, now);
    const id = name as SoundId;
    if (!this.sounds.has(id)) return; // unknown sound names are ignored by design (data-driven bindings)
    const buf = this.toBuffer(`sfx:${name}`, this.sounds.get(id));
    if (buf === null) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start();
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    if (this.bgmGain !== null && this.ctx !== null) this.bgmGain.gain.setTargetAtTime(ducked ? 0.3 : 1, this.ctx.currentTime, 0.2);
  }

  // ---------------------------------------------------------------- BGM (8 bars: bass + arp + perc)
  private note(kind: 'bass' | 'arp', midi: number): AudioBuffer | null {
    const tpl = kind === 'bass' ? BGM.bassTemplate : BGM.arpTemplate;
    const params = tpl.map((x, i) => (i === 2 ? midiToHz(midi) : x));
    return this.toBuffer(`${kind}:${midi}`, params, () => 0.5);
  }

  private playBuf(buf: AudioBuffer | null, when: number, gain = 1): void {
    if (buf === null || this.ctx === null || this.bgmGain === null) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (gain === 1) src.connect(this.bgmGain);
    else { const g = this.ctx.createGain(); g.gain.value = gain; src.connect(g).connect(this.bgmGain); }
    src.start(when);
  }

  private scheduleStep(idx: number, when: number): void {
    const bar = BGM.bars[Math.floor(idx / BGM.stepsPerBar) % BGM.bars.length]!;
    const s = idx % BGM.stepsPerBar;
    const off = BGM.bass[s];
    if (off !== null && off !== undefined) this.playBuf(this.note('bass', bar.root + off), when);
    const tones = bar.minor ? [0, 3, 7] : [0, 4, 7];
    const a = BGM.arp[s]!;
    this.playBuf(this.note('arp', bar.root + 24 + tones[a % 3]! + 12 * Math.floor(a / 3)), when);
    if (BGM.kick.includes(s)) this.playBuf(this.toBuffer('kick', BGM.kickParams, () => 0.5), when);
    if (BGM.snare.includes(s)) this.playBuf(this.toBuffer('snare', BGM.snareParams, () => 0.5), when);
    if (BGM.hat.includes(s)) this.playBuf(this.toBuffer('hat', BGM.hatParams, () => 0.5), when);
  }

  startBgm(): void {
    if (this.ctx === null || this.timer !== null) return;
    const stepDur = 60 / BGM.bpm / 4;
    const total = BGM.bars.length * BGM.stepsPerBar;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    const ctx = this.ctx;
    this.timer = window.setInterval(() => {
      while (this.nextTime < ctx.currentTime + 0.2) {
        this.scheduleStep(this.step, this.nextTime);
        this.nextTime += stepDur;
        this.step = (this.step + 1) % total;
      }
    }, 25);
    this.setDucked(this.ducked);
  }

  stopBgm(): void {
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
  }
}

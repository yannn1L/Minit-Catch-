import type { SoundId } from '../../core/ids.ts';
import type { Registry } from '../../core/Registry.ts';
import { BGM_EDITOR, BGM_SIM, type BgmDefinition } from '../../data/sounds.ts';
import type { ZzfxParams } from '../../shared/types.ts';
import { buildSamples, ZZFX_SAMPLE_RATE } from './zzfx.ts';

const SETTINGS_KEY = 'minitcatch.audio_v2';
const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

export type BgmTrack = 'editor' | 'sim';

interface AudioSettings {
  master: number;
  sfx: number;
  editorBgm: number;
  simBgm: number;
  muted: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  master: 0.8,
  sfx: 1.0,
  editorBgm: 0.6,
  simBgm: 0.7,
  muted: false,
};

/** SFX + procedural BGM via ZzFX sample buffers with dedicated multi-channel volume controls. */
export class ZzfxPlayer {
  private readonly sounds: Registry<SoundId, ZzfxParams>;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly lastPlayed = new Map<string, number>();
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private ducked = false;
  private activeTrack: BgmTrack = 'editor';

  constructor(sounds: Registry<SoundId, ZzfxParams>) {
    this.sounds = sounds;
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AudioSettings>;
        if (typeof parsed.master === 'number') this.settings.master = Math.max(0, Math.min(1, parsed.master));
        if (typeof parsed.sfx === 'number') this.settings.sfx = Math.max(0, Math.min(1, parsed.sfx));
        if (typeof parsed.editorBgm === 'number') this.settings.editorBgm = Math.max(0, Math.min(1, parsed.editorBgm));
        if (typeof parsed.simBgm === 'number') this.settings.simBgm = Math.max(0, Math.min(1, parsed.simBgm));
        if (typeof parsed.muted === 'boolean') this.settings.muted = parsed.muted;
      }
    } catch {
      /* ignore storage issues */
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
  }

  get isMuted(): boolean {
    return this.settings.muted;
  }

  get masterVolume(): number {
    return this.settings.master;
  }

  set masterVolume(v: number) {
    this.settings.master = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
    this.saveSettings();
    this.applyMasterGain();
  }

  get sfxVolume(): number {
    return this.settings.sfx;
  }

  set sfxVolume(v: number) {
    this.settings.sfx = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
    this.saveSettings();
    this.applySfxGain();
  }

  get editorBgmVolume(): number {
    return this.settings.editorBgm;
  }

  set editorBgmVolume(v: number) {
    this.settings.editorBgm = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
    this.saveSettings();
    if (this.activeTrack === 'editor') this.applyBgmGain();
  }

  get simBgmVolume(): number {
    return this.settings.simBgm;
  }

  set simBgmVolume(v: number) {
    this.settings.simBgm = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
    this.saveSettings();
    if (this.activeTrack === 'sim') this.applyBgmGain();
  }

  get currentTrack(): BgmTrack {
    return this.activeTrack;
  }

  async resume(): Promise<void> {
    try {
      if (this.ctx === null) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor === undefined) return;
        this.ctx = new Ctor();

        this.master = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.bgmGain = this.ctx.createGain();

        this.sfxGain.connect(this.master);
        this.bgmGain.connect(this.master);
        this.master.connect(this.ctx.destination);

        this.applyMasterGain();
        this.applySfxGain();
        this.applyBgmGain();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
    } catch (e) {
      console.warn('[ZzfxPlayer] audio resume failed/blocked:', e);
    }
  }

  toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    this.saveSettings();
    this.applyMasterGain();
    return this.settings.muted;
  }

  private applyMasterGain(): void {
    if (this.master === null || this.ctx === null) return;
    const target = this.settings.muted ? 0 : this.settings.master;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.01);
  }

  private applySfxGain(): void {
    if (this.sfxGain === null || this.ctx === null) return;
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx, this.ctx.currentTime, 0.01);
  }

  private applyBgmGain(): void {
    if (this.bgmGain === null || this.ctx === null) return;
    const baseVol = this.activeTrack === 'editor' ? this.settings.editorBgm : this.settings.simBgm;
    const target = (this.ducked ? 0.3 : 1) * baseVol;
    this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
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

  /** Plays a registered SFX routed through sfxGain. Same sound is rate-limited to 35 ms. */
  play(name: string, gain = 1): void {
    if (this.ctx === null || this.sfxGain === null || this.settings.muted || this.settings.sfx <= 0.01) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < 0.035) return;
    this.lastPlayed.set(name, now);
    const id = name as SoundId;
    if (!this.sounds.has(id)) return;
    const buf = this.toBuffer(`sfx:${name}`, this.sounds.get(id));
    if (buf === null) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.sfxGain);
    src.start();
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyBgmGain();
  }

  private getActiveBgmDef(): BgmDefinition {
    return this.activeTrack === 'sim' ? BGM_SIM : BGM_EDITOR;
  }

  private note(kind: 'bass' | 'arp', midi: number, bgm: BgmDefinition): AudioBuffer | null {
    const tpl = kind === 'bass' ? bgm.bassTemplate : bgm.arpTemplate;
    const params = tpl.map((x, i) => (i === 2 ? midiToHz(midi) : x));
    return this.toBuffer(`${this.activeTrack}:${kind}:${midi}`, params, () => 0.5);
  }

  private playBuf(buf: AudioBuffer | null, when: number, gain = 1): void {
    if (buf === null || this.ctx === null || this.bgmGain === null) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (gain === 1) {
      src.connect(this.bgmGain);
    } else {
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.bgmGain);
    }
    src.start(when);
  }

  private scheduleStep(idx: number, when: number): void {
    const bgm = this.getActiveBgmDef();
    const bar = bgm.bars[Math.floor(idx / bgm.stepsPerBar) % bgm.bars.length]!;
    const s = idx % bgm.stepsPerBar;
    const off = bgm.bass[s];
    if (off !== null && off !== undefined) this.playBuf(this.note('bass', bar.root + off, bgm), when);
    const tones = bar.minor ? [0, 3, 7] : [0, 4, 7];
    const a = bgm.arp[s]!;
    this.playBuf(this.note('arp', bar.root + 24 + tones[a % 3]! + 12 * Math.floor(a / 3), bgm), when);
    if (bgm.kick.includes(s)) this.playBuf(this.toBuffer(`${this.activeTrack}:kick`, bgm.kickParams, () => 0.5), when);
    if (bgm.snare.includes(s)) this.playBuf(this.toBuffer(`${this.activeTrack}:snare`, bgm.snareParams, () => 0.5), when);
    if (bgm.hat.includes(s)) this.playBuf(this.toBuffer(`${this.activeTrack}:hat`, bgm.hatParams, () => 0.5), when);
  }

  /** Switches or starts playback for the specified track ('editor' or 'sim'). */
  playTrack(track: BgmTrack): void {
    if (this.activeTrack === track && this.timer !== null) {
      this.applyBgmGain();
      return;
    }
    this.stopBgm();
    this.activeTrack = track;
    this.applyBgmGain();
    this.startBgm(track);
  }

  startBgm(track?: BgmTrack): void {
    if (track !== undefined) this.activeTrack = track;
    if (this.ctx === null || this.timer !== null) return;
    const bgm = this.getActiveBgmDef();
    const stepDur = 60 / bgm.bpm / 4;
    const total = bgm.bars.length * bgm.stepsPerBar;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.step = 0;
    const ctx = this.ctx;
    this.timer = window.setInterval(() => {
      while (this.nextTime < ctx.currentTime + 0.2) {
        this.scheduleStep(this.step, this.nextTime);
        this.nextTime += stepDur;
        this.step = (this.step + 1) % total;
      }
    }, 25);
    this.applyBgmGain();
  }

  stopBgm(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}

import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/**
 * "Marcha de la Justicia": melodía ORIGINAL de LegalAI, compuesta para este proyecto.
 * Estilo solemne de marcha (Re mayor, 84 bpm) con melodía tipo metal, bajo y acordes suaves.
 * Se sintetiza con Web Audio: no usa archivos de audio ni obras de terceros.
 * Nunca se reproduce sola: solo al pulsar el botón de música.
 */

type Note = [pitch: string | null, beats: number];

const BPM = 84;
const BEAT = 60 / BPM;

// Melodía (8 compases de 4 tiempos). null = silencio.
const MELODY: Note[] = [
  // A: presentación solemne
  ['D4', 1],
  ['F#4', 1],
  ['A4', 1],
  ['D5', 1],
  ['C#5', 1.5],
  ['B4', 0.5],
  ['A4', 2],
  ['B4', 1],
  ['G4', 1],
  ['E4', 1],
  ['A4', 1],
  ['F#4', 1.5],
  ['E4', 0.5],
  ['D4', 2],
  // B: ascenso y cadencia final
  ['A4', 1],
  ['B4', 1],
  ['C#5', 1],
  ['D5', 1],
  ['E5', 1.5],
  ['D5', 0.5],
  ['C#5', 1],
  ['B4', 1],
  ['A4', 1],
  ['F#4', 1],
  ['G4', 1],
  ['E4', 1],
  ['D4', 3],
  [null, 1],
];

// Armonía: un acorde por medio compás (2 tiempos), notas de la tríada.
const CHORDS: string[][] = [
  ['D3', 'F#3', 'A3'],
  ['D3', 'F#3', 'A3'],
  ['A2', 'C#3', 'E3'],
  ['A2', 'C#3', 'E3'],
  ['G2', 'B2', 'D3'],
  ['A2', 'C#3', 'E3'],
  ['D3', 'F#3', 'A3'],
  ['D3', 'F#3', 'A3'],
  ['D3', 'F#3', 'A3'],
  ['G2', 'B2', 'D3'],
  ['A2', 'C#3', 'E3'],
  ['A2', 'C#3', 'E3'],
  ['D3', 'F#3', 'A3'],
  ['G2', 'B2', 'D3'],
  ['D3', 'F#3', 'A3'],
  ['D3', 'F#3', 'A3'],
];

const TOTAL_BEATS = MELODY.reduce((sum, [, beats]) => sum + beats, 0);

const SEMITONES: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

/** 'A4' → 440 Hz (temperamento igual). */
export function noteToFrequency(note: string): number {
  const match = /^([A-G]#?)(\d)$/.exec(note);
  if (!match) throw new Error(`Nota no válida: ${note}`);
  const midi = (Number(match[2]) + 1) * 12 + SEMITONES[match[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export const LEGAL_THEME = {
  title: 'Marcha de la Justicia',
  bpm: BPM,
  beats: TOTAL_BEATS,
  melody: MELODY,
  chords: CHORDS,
};

@Injectable({ providedIn: 'root' })
export class LegalThemeMusicService {
  private readonly window = inject(DOCUMENT).defaultView;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  readonly playing = signal(false);
  readonly supported = !!this.audioCtor();
  /** Duración de una vuelta completa en segundos (~23 s). */
  readonly duration = TOTAL_BEATS * BEAT;

  toggle(): boolean {
    if (this.playing()) this.stop();
    else this.play();
    return this.playing();
  }

  play(): void {
    if (this.playing()) return;
    const Ctor = this.audioCtor();
    if (!Ctor) return;
    try {
      this.context ??= new Ctor();
      const ctx = this.context;
      if (ctx.state === 'suspended') void ctx.resume();
      this.master = ctx.createGain();
      this.master.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.master.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.4);
      this.master.connect(ctx.destination);
      this.addEcho(ctx, this.master);
      this.playing.set(true);
      this.scheduleLoop(ctx.currentTime + 0.1);
    } catch {
      this.playing.set(false);
    }
  }

  stop(): void {
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = null;
    const ctx = this.context;
    const master = this.master;
    this.master = null;
    this.playing.set(false);
    if (!ctx || !master) return;
    // Salida suave para que no "corte" de golpe.
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    setTimeout(() => master.disconnect(), 450);
  }

  /** Programa una vuelta completa y la siguiente un poco antes de que termine (bucle). */
  private scheduleLoop(start: number): void {
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master || !this.playing()) return;
    let t = start;
    for (const [pitch, beats] of MELODY) {
      if (pitch) this.brass(ctx, master, noteToFrequency(pitch), t, beats * BEAT);
      t += beats * BEAT;
    }
    CHORDS.forEach((chord, i) => {
      const at = start + i * 2 * BEAT;
      chord.forEach((n) => this.pad(ctx, master, noteToFrequency(n), at, 2 * BEAT));
      this.bass(ctx, master, noteToFrequency(chord[0]) / 2, at, 2 * BEAT);
      this.timpani(ctx, master, at);
    });
    const end = start + this.duration;
    const wait = (end - ctx.currentTime - 0.5) * 1000;
    this.loopTimer = setTimeout(() => this.scheduleLoop(end), Math.max(wait, 0));
  }

  /** Melodía tipo metal: diente de sierra filtrado con ataque marcado y vibrato leve. */
  private brass(ctx: AudioContext, out: AudioNode, freq: number, at: number, length: number) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const vibrato = ctx.createOscillator();
    const vibratoDepth = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    vibrato.frequency.value = 5;
    vibratoDepth.gain.value = freq * 0.004;
    vibrato.connect(vibratoDepth).connect(osc.frequency);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, at);
    filter.frequency.linearRampToValueAtTime(2200, at + 0.08);
    filter.frequency.linearRampToValueAtTime(1400, at + length);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.11, at + 0.05);
    gain.gain.setValueAtTime(0.09, at + Math.max(length - 0.12, 0.06));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(filter).connect(gain).connect(out);
    osc.start(at);
    vibrato.start(at);
    osc.stop(at + length + 0.05);
    vibrato.stop(at + length + 0.05);
  }

  /** Acordes de fondo tipo órgano suave. */
  private pad(ctx: AudioContext, out: AudioNode, freq: number, at: number, length: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.025, at + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  private bass(ctx: AudioContext, out: AudioNode, freq: number, at: number, length: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.14, at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length * 0.9);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + length);
  }

  /** Golpe de timbal: tono grave que cae rápido, como un mazo solemne. */
  private timpani(ctx: AudioContext, out: AudioNode, at: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, at);
    osc.frequency.exponentialRampToValueAtTime(55, at + 0.25);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.18, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + 0.5);
  }

  /** Eco breve que da sensación de sala amplia (tribunal): master → delay ↺ → destino. */
  private addEcho(ctx: AudioContext, source: AudioNode): void {
    const delay = ctx.createDelay();
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    delay.delayTime.value = 0.18;
    feedback.gain.value = 0.3;
    wet.gain.value = 0.25;
    source.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(ctx.destination);
  }

  private audioCtor(): typeof AudioContext | undefined {
    return (
      this.window?.AudioContext ??
      (this.window as unknown as { webkitAudioContext?: typeof AudioContext })?.webkitAudioContext
    );
  }
}

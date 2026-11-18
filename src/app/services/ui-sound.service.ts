import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

type Tone = { frequency: number; start: number; duration: number };

/**
 * Sonidos cortos de interfaz generados con Web Audio (sin archivos de audio).
 * Si el navegador no soporta audio o lo bloquea, no hace nada.
 */
@Injectable({ providedIn: 'root' })
export class UiSoundService {
  private readonly window = inject(DOCUMENT).defaultView;
  private context: AudioContext | null = null;

  /** Dos notas suaves: subiendo al pasar a inglés, bajando al volver a español. */
  languageChanged(language: 'es' | 'en'): void {
    const [low, high] = [587.33, 880]; // Re5 y La5
    const notes = language === 'en' ? [low, high] : [high, low];
    this.play(notes.map((frequency, i) => ({ frequency, start: i * 0.09, duration: 0.14 })));
  }

  private play(tones: Tone[]): void {
    const AudioCtor =
      this.window?.AudioContext ??
      (this.window as unknown as { webkitAudioContext?: typeof AudioContext })?.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      this.context ??= new AudioCtor();
      const ctx = this.context;
      if (ctx.state === 'suspended') void ctx.resume();
      const t0 = ctx.currentTime;
      for (const tone of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = tone.frequency;
        // Volumen bajo con entrada y salida suaves para que no "chasquee".
        gain.gain.setValueAtTime(0.0001, t0 + tone.start);
        gain.gain.exponentialRampToValueAtTime(0.08, t0 + tone.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.start + tone.duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + tone.start);
        osc.stop(t0 + tone.start + tone.duration + 0.02);
      }
    } catch {
      // Audio bloqueado por el navegador: el cambio de idioma funciona igual, sin sonido.
    }
  }
}

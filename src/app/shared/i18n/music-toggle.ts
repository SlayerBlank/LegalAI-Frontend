import { Component, inject, signal } from '@angular/core';
import { LegalThemeMusicService } from '../../services/legal-theme-music.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from './i18n.pipes';

/** Botón 🎵 para la "Marcha de la Justicia". Nunca suena sola: solo al pulsarlo. */
@Component({
  selector: 'app-music-toggle',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <button
      type="button"
      class="music"
      [class.playing]="music.playing()"
      [attr.aria-pressed]="music.playing()"
      [disabled]="!music.supported"
      [attr.aria-label]="
        (music.supported ? (music.playing() ? 'music.stop' : 'music.play') : 'music.unsupported')
          | t
      "
      [title]="
        (music.supported ? (music.playing() ? 'music.stop' : 'music.play') : 'music.unsupported')
          | t
      "
      (click)="toggle()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
    <span class="sr-only" aria-live="polite">{{ announcement() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .music {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--muted);
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        color 0.2s ease,
        box-shadow 0.2s ease;
    }
    .music:hover:not(:disabled) {
      border-color: var(--primary);
      color: var(--primary);
    }
    .music.playing {
      color: #fff;
      border-color: transparent;
      background: linear-gradient(135deg, #b8860b, #d4a72c);
      box-shadow: 0 4px 14px #b8860b55;
    }
    .music:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .music:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .bars {
      display: none;
      align-items: flex-end;
      gap: 2px;
      height: 12px;
    }
    .playing .bars {
      display: inline-flex;
    }
    .bars i {
      width: 3px;
      background: currentColor;
      border-radius: 2px;
      animation: eq 0.9s ease-in-out infinite;
    }
    .bars i:nth-child(2) {
      animation-delay: 0.2s;
    }
    .bars i:nth-child(3) {
      animation-delay: 0.4s;
    }
    @keyframes eq {
      0%,
      100% {
        height: 3px;
      }
      50% {
        height: 12px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bars i {
        animation: none;
        height: 8px;
      }
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
})
/** La música es global (servicio raíz): sigue sonando al navegar entre páginas. */
export class MusicToggleComponent {
  readonly music = inject(LegalThemeMusicService);
  private readonly i18n = inject(I18nService);
  readonly announcement = signal('');

  toggle(): void {
    const playing = this.music.toggle();
    this.announcement.set(this.i18n.t(playing ? 'music.nowPlaying' : 'music.stopped'));
  }
}

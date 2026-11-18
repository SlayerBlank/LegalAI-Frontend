import { Component, inject, signal } from '@angular/core';
import { Language } from '../../i18n/dictionaries';
import { I18nService } from '../../services/i18n.service';
import { UiSoundService } from '../../services/ui-sound.service';
import { TranslatePipe } from './i18n.pipes';

/** i18n: selector de idioma ES / EN con sonido corto y anuncio accesible del cambio. */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="language-switch" role="group" [attr.aria-label]="'i18n.title' | t">
      <span class="tag" aria-hidden="true" [title]="'i18n.title' | t">{{ 'i18n.badge' | t }}</span>
      @for (lang of i18n.languages; track lang) {
        <button
          type="button"
          [attr.aria-pressed]="i18n.language() === lang"
          [attr.data-language]="lang"
          [title]="'language.' + lang | t"
          [attr.lang]="lang"
          (click)="select(lang)"
        >
          {{ lang.toUpperCase() }}
        </button>
      }
    </div>
    <span class="sr-only" aria-live="polite">{{ announcement() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .language-switch {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--border);
    }
    .tag {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      padding: 0 0.45rem 0 0.55rem;
      color: var(--primary);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    button {
      border: 0;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      cursor: pointer;
      transition:
        background 0.2s ease,
        color 0.2s ease,
        transform 0.15s ease;
    }
    button:hover {
      color: var(--text);
    }
    button:active {
      transform: scale(0.94);
    }
    button[aria-pressed='true'] {
      background: var(--primary);
      color: var(--surface);
      box-shadow: 0 2px 8px #2563eb40;
    }
    button:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `,
})
export class LanguageSwitcherComponent {
  readonly i18n = inject(I18nService);
  private readonly sound = inject(UiSoundService);
  readonly announcement = signal('');

  select(language: Language): void {
    if (language === this.i18n.language()) return;
    this.i18n.setLanguage(language);
    this.sound.languageChanged(language);
    this.announcement.set(this.i18n.t('language.changed'));
  }
}

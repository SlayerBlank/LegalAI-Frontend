import { Component, computed, inject, signal } from '@angular/core';
import { I18nService, RegionLocale } from '../../services/i18n.service';
import { UiSoundService } from '../../services/ui-sound.service';
import { TranslatePipe } from './i18n.pipes';

const SAMPLE_DATE = new Date(2026, 10, 18, 15, 30);
const SAMPLE_NUMBER = 1234567.89;

/**
 * l10n: elige la región que define el formato de fechas y números,
 * independiente del idioma de los textos (p. ej. textos en inglés con formato de Perú).
 */
@Component({
  selector: 'app-region-switcher',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <label class="region-switch" [title]="'l10n.title' | t">
      <span class="tag" aria-hidden="true">{{ 'l10n.badge' | t }}</span>
      <span class="sr-only">{{ 'l10n.label' | t }}</span>
      <select
        [value]="i18n.region() ?? ''"
        (change)="select($any($event.target).value)"
        [attr.aria-describedby]="'region-example'"
      >
        <option value="">{{ 'l10n.auto' | t }} · {{ example(null) }}</option>
        @for (region of i18n.regions; track region) {
          <option [value]="region">{{ 'region.' + region | t }} · {{ example(region) }}</option>
        }
      </select>
    </label>
    <span id="region-example" class="sr-only">{{
      'l10n.example' | t: { example: current() }
    }}</span>
    <span class="sr-only" aria-live="polite">{{ announcement() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .region-switch {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      padding: 3px 3px 3px 0;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--border);
      cursor: pointer;
      transition: border-color 0.2s ease;
    }
    .region-switch:hover,
    .region-switch:focus-within {
      border-color: var(--primary);
    }
    .tag {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      padding: 0 0.3rem 0 0.65rem;
      color: var(--primary);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    select {
      border: 0;
      background: transparent;
      color: var(--text);
      font: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.3rem 0.5rem;
      border-radius: 999px;
      max-width: 13rem;
      cursor: pointer;
    }
    select:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    option {
      color: #111827;
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
export class RegionSwitcherComponent {
  readonly i18n = inject(I18nService);
  private readonly sound = inject(UiSoundService);
  readonly announcement = signal('');
  readonly current = computed(() => this.example(this.i18n.region()));

  /** Muestra cómo se verá una fecha y un número con esa región. */
  example(region: RegionLocale | null): string {
    const locale = region ?? (this.i18n.language() === 'en' ? 'en-US' : 'es-PE');
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(SAMPLE_DATE);
    const number = new Intl.NumberFormat(locale).format(SAMPLE_NUMBER);
    return `${date} · ${number}`;
  }

  select(value: string): void {
    const region = (this.i18n.regions as readonly string[]).includes(value)
      ? (value as RegionLocale)
      : null;
    if (region === this.i18n.region()) return;
    this.i18n.setRegion(region);
    this.sound.regionChanged();
    const name = region ? this.i18n.t(`region.${region}`) : this.i18n.t('l10n.auto');
    this.announcement.set(this.i18n.t('l10n.changed', { region: name }));
  }
}

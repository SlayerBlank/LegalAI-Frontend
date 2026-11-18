import { Pipe, PipeTransform, inject } from '@angular/core';
import { AnyTranslationKey, I18nService, TranslationParams } from '../../services/i18n.service';

/**
 * {{ 'docs.title' | t }}  ·  {{ 'docs.viewChunks' | t: { count: 3 } }}
 * Impuro a propósito: lee la señal del idioma, así la vista cambia al instante.
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(key: AnyTranslationKey, params?: TranslationParams): string {
    return this.i18n.t(key, params);
  }
}

/** {{ fecha | ldate }} → 18/11/2026 10:30 (es-PE) · 11/18/2026, 10:30 AM (en-US) */
@Pipe({ name: 'ldate', standalone: true, pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(value: string | Date | null | undefined, withSeconds = false): string {
    return this.i18n.formatDate(value, withSeconds);
  }
}

/** {{ 1234.5 | lnumber: 1 }} → 1,234.5 (en) · 1 234,5 (es-PE) */
@Pipe({ name: 'lnumber', standalone: true, pure: false })
export class LocalNumberPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(value: number | null | undefined, maximumFractionDigits = 0): string {
    return this.i18n.formatNumber(value, maximumFractionDigits);
  }
}

export const I18N_PIPES = [TranslatePipe, LocalDatePipe, LocalNumberPipe] as const;

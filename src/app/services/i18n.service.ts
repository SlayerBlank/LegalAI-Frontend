import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { DICTIONARIES, Language, TranslationKey } from '../i18n/dictionaries';

/** Región por defecto de cada idioma cuando el usuario no eligió una (modo automático). */
const DEFAULT_REGION: Record<Language, RegionLocale> = { es: 'es-PE', en: 'en-US' };
const STORAGE_KEY = 'legalai-language';
const REGION_KEY = 'legalai-region';

/** Regiones (l10n) disponibles: definen el formato de fechas y números, no el idioma. */
export const REGIONS = ['es-PE', 'es-MX', 'es-ES', 'en-US', 'en-GB'] as const;
export type RegionLocale = (typeof REGIONS)[number];

export type TranslationParams = Record<string, string | number>;
/** Clave conocida o compuesta en tiempo de ejecución (p. ej. 'status.' + estado). */
export type AnyTranslationKey = TranslationKey | (string & {});

/**
 * Internacionalización (i18n) y localización (l10n) en tiempo de ejecución.
 * El idioma es una señal: al cambiarlo se actualizan las vistas sin recargar.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  readonly language = signal<Language>(this.initialLanguage());
  /** Región elegida a mano; null = automática según el idioma. */
  readonly region = signal<RegionLocale | null>(this.initialRegion());
  /** Locale efectivo para Intl: la región elegida o la del idioma (l10n). */
  readonly locale = computed<RegionLocale>(() => this.region() ?? DEFAULT_REGION[this.language()]);
  readonly languages: readonly Language[] = ['es', 'en'];
  readonly regions = REGIONS;

  constructor() {
    this.apply(this.language());
  }

  /** Traduce una clave e interpola {parametros}. Si falta en el idioma, usa español. */
  t(key: AnyTranslationKey, params?: TranslationParams): string {
    const k = key as TranslationKey;
    const text = DICTIONARIES[this.language()][k] ?? DICTIONARIES.es[k] ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }

  setLanguage(language: Language): void {
    if (language === this.language()) return;
    this.language.set(language);
    this.apply(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Almacenamiento bloqueado (modo privado): el idioma se mantiene solo en esta sesión.
    }
  }

  /** l10n: cambia solo el formato regional (fechas y números); null vuelve al automático. */
  setRegion(region: RegionLocale | null): void {
    this.region.set(region);
    try {
      if (region) localStorage.setItem(REGION_KEY, region);
      else localStorage.removeItem(REGION_KEY);
    } catch {
      // Sin almacenamiento: la región se mantiene solo en esta sesión.
    }
  }

  toggle(): Language {
    const next = this.language() === 'es' ? 'en' : 'es';
    this.setLanguage(next);
    return next;
  }

  /** Fecha localizada con Intl según la región (dd/MM/yyyy en es-PE, MM/dd/yyyy en en-US). */
  formatDate(value: string | Date | null | undefined, withSeconds = false): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(this.locale(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(withSeconds ? { second: '2-digit' } : {}),
    }).format(date);
  }

  formatNumber(value: number | null | undefined, maximumFractionDigits = 0): string {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat(this.locale(), { maximumFractionDigits }).format(value);
  }

  /** Tamaño de archivo con separadores de la región: "1,5 MB" (es-ES) / "1.5 MB" (en-US). */
  formatBytes(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined) return '—';
    if (bytes < 1024) return `${this.formatNumber(bytes)} B`;
    if (bytes < 1024 * 1024) return `${this.formatNumber(bytes / 1024, 1)} KB`;
    return `${this.formatNumber(bytes / (1024 * 1024), 1)} MB`;
  }

  private initialLanguage(): Language {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'es' || saved === 'en') return saved;
    } catch {
      // Sin acceso a localStorage: se usa el idioma por defecto.
    }
    // La aplicación nace en español; el usuario elige inglés con el selector.
    return 'es';
  }

  private initialRegion(): RegionLocale | null {
    try {
      const saved = localStorage.getItem(REGION_KEY);
      return (REGIONS as readonly string[]).includes(saved ?? '') ? (saved as RegionLocale) : null;
    } catch {
      return null;
    }
  }

  private apply(language: Language): void {
    this.document.documentElement.lang = language;
  }
}

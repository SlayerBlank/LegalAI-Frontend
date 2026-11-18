import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { I18nService } from './i18n.service';
import { UiSoundService } from './ui-sound.service';
import { LanguageSwitcherComponent } from '../shared/i18n/language-switcher';
import { EN } from '../i18n/en';
import { ES } from '../i18n/es';

describe('I18nService (i18n + l10n)', () => {
  beforeEach(() => {
    localStorage.removeItem('legalai-language');
    TestBed.configureTestingModule({});
  });
  afterEach(() => localStorage.removeItem('legalai-language'));

  it('empieza en español y marca el atributo lang del documento', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.language()).toBe('es');
    expect(i18n.locale()).toBe('es-PE');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('es');
    expect(i18n.t('docs.title')).toBe('Documentos');
  });

  it('cambia a inglés, lo recuerda y actualiza el locale', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    expect(i18n.t('docs.title')).toBe('Documents');
    expect(i18n.locale()).toBe('en-US');
    expect(localStorage.getItem('legalai-language')).toBe('en');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('en');
  });

  it('restaura el idioma guardado', () => {
    localStorage.setItem('legalai-language', 'en');
    expect(TestBed.inject(I18nService).language()).toBe('en');
  });

  it('interpola parámetros y deja intactos los que faltan', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.t('docs.viewChunks', { count: 4 })).toBe('Ver 4 fragmentos');
    expect(i18n.t('docs.viewChunks')).toBe('Ver {count} fragmentos');
    expect(i18n.t('clave.inexistente')).toBe('clave.inexistente');
  });

  it('formatea fechas, números y tamaños según el idioma (l10n)', () => {
    const i18n = TestBed.inject(I18nService);
    const date = '2026-11-18T09:05:00';
    expect(i18n.formatDate(date)).toContain('18/11/2026');
    expect(i18n.formatNumber(1234.5, 1)).toMatch(/1[\s,.]?234[.,]5/);
    expect(i18n.formatBytes(1536)).toBe(`${i18n.formatNumber(1.5, 1)} KB`);
    i18n.setLanguage('en');
    expect(i18n.formatDate(date)).toContain('11/18/2026');
    expect(i18n.formatNumber(1234.5, 1)).toBe('1,234.5');
    expect(i18n.formatBytes(1536)).toBe('1.5 KB');
    expect(i18n.formatDate('no-es-fecha')).toBe('—');
    expect(i18n.formatBytes(null)).toBe('—');
  });

  it('los diccionarios tienen exactamente las mismas claves y ninguna vacía', () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(ES).sort());
    for (const [key, text] of Object.entries(EN)) expect(text.trim(), key).not.toBe('');
  });

  it('las claves de parámetros coinciden entre idiomas', () => {
    const params = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(ES) as (keyof typeof ES)[]) {
      expect(params(EN[key]), key).toEqual(params(ES[key]));
    }
  });
});

describe('LanguageSwitcherComponent', () => {
  let sound: { languageChanged: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.removeItem('legalai-language');
    sound = { languageChanged: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: UiSoundService, useValue: sound }] });
  });
  afterEach(() => localStorage.removeItem('legalai-language'));

  it('cambia el idioma con un clic, suena y anuncia el cambio', async () => {
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const en = el.querySelector<HTMLButtonElement>('[data-language="en"]')!;
    expect(en.getAttribute('aria-pressed')).toBe('false');
    en.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(TestBed.inject(I18nService).language()).toBe('en');
    expect(sound.languageChanged).toHaveBeenCalledWith('en');
    expect(en.getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain('Language changed to English');
  });

  it('no suena si se pulsa el idioma que ya está activo', () => {
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-language="es"]').click();
    expect(sound.languageChanged).not.toHaveBeenCalled();
  });
});

describe('UiSoundService', () => {
  it('no falla cuando el navegador no tiene Web Audio', () => {
    TestBed.configureTestingModule({});
    expect(() => TestBed.inject(UiSoundService).languageChanged('en')).not.toThrow();
  });
});

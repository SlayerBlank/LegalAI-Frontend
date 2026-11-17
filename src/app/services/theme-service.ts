import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'legalai-theme';
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  readonly preference = signal<ThemePreference>(this.savedPreference());
  readonly theme = signal<Theme>(this.resolve(this.preference()));
  constructor() {
    this.apply(this.theme());
    const onSystemChange = () => {
      if (this.preference() === 'system') this.update(this.resolve('system'));
    };
    this.media?.addEventListener?.('change', onSystemChange);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener?.('change', onSystemChange));
  }
  toggle(): void {
    this.setTheme(this.theme() === 'light' ? 'dark' : 'light');
  }
  setTheme(theme: Theme): void {
    this.setPreference(theme);
  }
  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    if (preference === 'system') localStorage.removeItem(this.storageKey);
    else localStorage.setItem(this.storageKey, preference);
    this.update(this.resolve(preference));
  }
  private savedPreference(): ThemePreference {
    const saved = localStorage.getItem(this.storageKey);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  }
  private resolve(preference: ThemePreference): Theme {
    return preference === 'system' ? (this.media?.matches ? 'dark' : 'light') : preference;
  }
  private update(theme: Theme): void {
    this.theme.set(theme);
    this.apply(theme);
  }
  private apply(theme: Theme): void {
    this.document.documentElement.dataset['theme'] = theme;
  }
}

import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoginService } from '../../../services/login-service';
import { ThemePreference, ThemeService } from '../../../services/theme-service';
import { LanguageSwitcherComponent } from '../../../shared/i18n/language-switcher';
import { RegionSwitcherComponent } from '../../../shared/i18n/region-switcher';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { I18nService } from '../../../services/i18n.service';
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [LanguageSwitcherComponent, RegionSwitcherComponent, ...I18N_PIPES],
  templateUrl: './navbar-component.html',
  styleUrl: './navbar-component.css',
})
export class NavbarComponent {
  readonly menuRequested = output<void>();
  readonly menuOpen = input(false);
  readonly theme = inject(ThemeService);
  readonly loginService = inject(LoginService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  readonly currentPath = signal(this.path());
  readonly now = signal(new Date());
  readonly options: { value: ThemePreference; labelKey: string }[] = [
    { value: 'light', labelKey: 'navbar.themeLight' },
    { value: 'dark', labelKey: 'navbar.themeDark' },
    { value: 'system', labelKey: 'navbar.themeSystem' },
  ];
  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) this.currentPath.set(this.path());
    });
    const timer = setInterval(() => this.now.set(new Date()), 60000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
  private path(): string {
    try {
      const tree = this.router.parseUrl(this.router.url);
      return (
        '/' + (tree.root.children['primary']?.segments.map((s) => s.path).join('/') || 'dashboard')
      );
    } catch {
      return '/dashboard';
    }
  }
  get selectedTheme(): string {
    const option = this.options.find((item) => item.value === this.theme.preference())!;
    return this.i18n.t(option.labelKey);
  }
  get today(): string {
    const parts = new Intl.DateTimeFormat(this.i18n.locale(), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).formatToParts(this.now());
    const part = (type: string) => parts.find((p) => p.type === type)?.value.replace('.', '') ?? '';
    const weekday = part('weekday');
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${part('day')} ${part('month')} ${part('year')}`;
  }
}

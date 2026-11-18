import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoginService } from '../../../services/login-service';
import { ThemePreference, ThemeService } from '../../../services/theme-service';
import { LanguageSwitcherComponent } from '../../../shared/i18n/language-switcher';
import { RegionSwitcherComponent } from '../../../shared/i18n/region-switcher';
import { MusicToggleComponent } from '../../../shared/i18n/music-toggle';
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [LanguageSwitcherComponent, RegionSwitcherComponent, MusicToggleComponent],
  templateUrl: './navbar-component.html',
  styleUrl: './navbar-component.css',
})
export class NavbarComponent {
  readonly menuRequested = output<void>();
  readonly menuOpen = input(false);
  readonly theme = inject(ThemeService);
  readonly loginService = inject(LoginService);
  private readonly router = inject(Router);
  readonly currentPath = signal(this.path());
  readonly now = signal(new Date());
  readonly options: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
    { value: 'system', label: 'Sistema' },
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
    return this.options.find((option) => option.value === this.theme.preference())!.label;
  }
  get today(): string {
    const parts = new Intl.DateTimeFormat('es', {
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

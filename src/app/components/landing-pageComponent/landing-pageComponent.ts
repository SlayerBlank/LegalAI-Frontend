import { Component, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageSwitcherComponent } from '../../shared/i18n/language-switcher';
import { RegionSwitcherComponent } from '../../shared/i18n/region-switcher';
import { MusicToggleComponent } from '../../shared/i18n/music-toggle';
import { ThemePreference, ThemeService } from '../../services/theme-service';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    RouterLink,
    LanguageSwitcherComponent,
    RegionSwitcherComponent,
    MusicToggleComponent,
    ...I18N_PIPES,
  ],
  templateUrl: './landing-pageComponent.html',
  styleUrls: [
    './landing-pageComponent.css',
    './landing-hero.css',
    './landing-sections.css',
    './landing-footer.css',
    './landing-responsive.css',
  ],
  host: { '[attr.data-appearance]': 'theme.theme()' },
})
export class LandingPageComponent {
  readonly theme = inject(ThemeService);
  readonly themes: { value: ThemePreference; labelKey: string }[] = [
    { value: 'light', labelKey: 'public.themeLight' },
    { value: 'dark', labelKey: 'public.themeDark' },
    { value: 'system', labelKey: 'public.themeSystem' },
  ];
  menuOpen = false;
  @HostListener('document:keydown.escape') closeMenu(): void {
    this.menuOpen = false;
  }
}

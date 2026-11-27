import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme-service';
import { PublicThemeSwitcher } from './public-theme-switcher';
import { LanguageSwitcherComponent } from '../i18n/language-switcher';
import { RegionSwitcherComponent } from '../i18n/region-switcher';
import { MusicToggleComponent } from '../i18n/music-toggle';
import { I18N_PIPES } from '../i18n/i18n.pipes';
@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [
    RouterLink,
    PublicThemeSwitcher,
    LanguageSwitcherComponent,
    RegionSwitcherComponent,
    MusicToggleComponent,
    ...I18N_PIPES,
  ],
  templateUrl: './public-header.html',
  styleUrl: './public-header.css',
})
export class PublicHeader {
  readonly theme = inject(ThemeService);
  readonly pathLabel = input.required<string>();
  readonly notFound = input(false);
  readonly workspace = input(false);
}

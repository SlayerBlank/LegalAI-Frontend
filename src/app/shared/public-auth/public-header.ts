import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme-service';
import { PublicThemeSwitcher } from './public-theme-switcher';
import { RegionSwitcherComponent } from '../i18n/region-switcher';
import { MusicToggleComponent } from '../i18n/music-toggle';
@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [
    RouterLink,
    PublicThemeSwitcher,
    RegionSwitcherComponent,
    MusicToggleComponent,
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

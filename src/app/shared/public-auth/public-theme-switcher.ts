import { Component, inject } from '@angular/core';
import { ThemePreference, ThemeService } from '../../services/theme-service';
import { I18N_PIPES } from '../i18n/i18n.pipes';
@Component({
  selector: 'app-public-theme-switcher',
  standalone: true,
  imports: [...I18N_PIPES],
  templateUrl: './public-theme-switcher.html',
  styleUrl: './public-theme-switcher.css',
})
export class PublicThemeSwitcher {
  readonly theme = inject(ThemeService);
  readonly options: { value: ThemePreference; labelKey: string }[] = [
    { value: 'light', labelKey: 'public.themeLight' },
    { value: 'dark', labelKey: 'public.themeDark' },
    { value: 'system', labelKey: 'public.themeSystem' },
  ];
}

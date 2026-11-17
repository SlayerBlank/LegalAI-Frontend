import { Component, inject } from '@angular/core';
import { ThemePreference, ThemeService } from '../../services/theme-service';
@Component({
  selector: 'app-public-theme-switcher',
  standalone: true,
  templateUrl: './public-theme-switcher.html',
  styleUrl: './public-theme-switcher.css',
})
export class PublicThemeSwitcher {
  readonly theme = inject(ThemeService);
  readonly options: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
    { value: 'system', label: 'Sistema' },
  ];
}

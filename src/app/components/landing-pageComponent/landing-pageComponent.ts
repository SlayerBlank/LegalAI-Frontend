import { Component, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemePreference, ThemeService } from '../../services/theme-service';
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink],
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
  readonly themes: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
    { value: 'system', label: 'Sistema' },
  ];
  menuOpen = false;
  @HostListener('document:keydown.escape') closeMenu(): void {
    this.menuOpen = false;
  }
}

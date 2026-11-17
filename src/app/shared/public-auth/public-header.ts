import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme-service';
import { PublicThemeSwitcher } from './public-theme-switcher';
@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [RouterLink, PublicThemeSwitcher],
  templateUrl: './public-header.html',
  styleUrl: './public-header.css',
})
export class PublicHeader {
  readonly theme = inject(ThemeService);
  readonly pathLabel = input.required<string>();
  readonly notFound = input(false);
  readonly workspace = input(false);
}

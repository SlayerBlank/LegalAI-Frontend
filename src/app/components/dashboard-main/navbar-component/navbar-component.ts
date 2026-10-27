import { Component, ElementRef, HostListener, inject, output } from '@angular/core';
import { LoginService } from '../../../services/login-service';
import { ThemeService } from '../../../services/theme-service';

@Component({ selector: 'app-navbar', templateUrl: './navbar-component.html', styleUrl: './navbar-component.css' })
export class NavbarComponent {
  readonly menuRequested = output<void>();
  readonly theme = inject(ThemeService);
  readonly loginService = inject(LoginService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  userMenuOpen = false;
  profileOpen = false;

  userInitials(): string {
    const name = this.loginService.currentUser()?.fullName?.trim();
    return name ? name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() : 'U';
  }

  toggleUserMenu(): void { this.userMenuOpen = !this.userMenuOpen; if (!this.userMenuOpen) this.profileOpen = false; }
  toggleProfile(): void { this.profileOpen = !this.profileOpen; }
  logout(): void { this.userMenuOpen = false; this.profileOpen = false; this.loginService.logout(); }

  onUserMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { this.userMenuOpen = false; this.profileOpen = false; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.toggleUserMenu(); }
  }

  @HostListener('document:click', ['$event'])
  closeWhenClickedOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) { this.userMenuOpen = false; this.profileOpen = false; }
  }
}

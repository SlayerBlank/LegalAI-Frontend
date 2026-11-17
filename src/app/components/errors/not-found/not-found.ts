import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginService } from '../../../services/login-service';
import { PublicHeader } from '../../../shared/public-auth/public-header';
import { PublicThemeSwitcher } from '../../../shared/public-auth/public-theme-switcher';
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, PublicHeader, PublicThemeSwitcher],
  templateUrl: './not-found.html',
  styleUrls: ['../../../shared/public-auth/public-tokens.css', './not-found.css'],
})
export class NotFoundComponent {
  private readonly login = inject(LoginService);
  // Solo el destino de un enlace: el guard existente valida la sesión al entrar al Dashboard.
  // No restaurar ni alterar la sesión desde una ruta desconocida.
  get hasSession(): boolean {
    return (
      this.login.state() === 'authenticated' ||
      (this.login.state() === 'initializing' && !!this.login.getAccessToken())
    );
  }
}

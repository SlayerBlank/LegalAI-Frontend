import { Component, ElementRef, HostListener, effect, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LoginService } from '../../../services/login-service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { WorkspaceIcon } from '../workspace-icon';
interface WorkspaceLink {
  title: string;
  path: string;
  icon: string;
  /** Clave i18n del título; si existe, tiene prioridad sobre title. */
  titleKey?: string;
  /** Activo también en las rutas hijas (p. ej. /reportes/...). */
  prefix?: boolean;
}
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, WorkspaceIcon, ...I18N_PIPES],
  templateUrl: './sidebar-component.html',
  styleUrl: './sidebar-component.css',
})
export class SidebarComponent {
  readonly activeMatch = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  } as const;
  readonly prefixMatch = { ...this.activeMatch, paths: 'subset' } as const;
  readonly open = input(false);
  readonly compact = input(false);
  readonly closeRequested = output<void>();
  readonly login = inject(LoginService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  profileOpen = false;
  readonly mainLinks: WorkspaceLink[] = [
    { title: 'Resumen', path: '/dashboard', icon: 'summary' },
    { title: 'Clientes', path: '/clientes', icon: 'clients' },
    { title: 'Expedientes', path: '/expedientes', icon: 'cases' },
    { title: 'Documentos', path: '/documentos', icon: 'documents' },
    { title: 'Reportes', titleKey: 'reports.nav', path: '/reportes', icon: 'reports', prefix: true },
  ];
  readonly aiLinks: WorkspaceLink[] = [
    { title: 'Chat IA', path: '/chat-ia', icon: 'ai' },
    { title: 'Borradores', path: '/borradores', icon: 'drafts' },
    { title: 'Resúmenes', path: '/resumenes', icon: 'summaries' },
    { title: 'Citaciones IA', path: '/citaciones-ia', icon: 'citations' },
  ];
  readonly adminLinks: WorkspaceLink[] = [
    { title: 'Gestión de usuarios', path: '/gestionusuarios', icon: 'users' },
    { title: 'Roles y permisos', path: '/roles', icon: 'roles' },
    { title: 'Auditoría', path: '/auditoria', icon: 'audit' },
  ];
  constructor() {
    effect(() => {
      if (this.open() && this.compact()) queueMicrotask(() => this.focusables()[0]?.focus());
    });
  }
  private focusables(): HTMLElement[] {
    return Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        'aside a[href],aside button:not(:disabled)',
      ),
    );
  }
  userInitials(): string {
    const name = this.login.currentUser()?.fullName?.trim();
    return name
      ? name
          .split(/\s+/)
          .slice(0, 2)
          .map((p) => p[0])
          .join('')
          .toUpperCase()
      : 'U';
  }
  logout(): void {
    this.profileOpen = false;
    this.closeRequested.emit();
    this.login.logout();
  }
  @HostListener('keydown', ['$event']) onKey(event: KeyboardEvent): void {
    if (!this.compact() || !this.open()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeRequested.emit();
    }
    if (event.key === 'Tab') {
      const items = this.focusables(),
        first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
}

import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginService } from '../../services/login-service';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { REPORTS } from './report-catalog';

/** Índice del módulo Reportes (Sprint 4): una tarjeta por reporte. */
@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [RouterLink, ...I18N_PIPES],
  templateUrl: './reportes-component.html',
  styleUrl: './reportes-component.css',
})
export class ReportesComponent {
  private readonly login = inject(LoginService);

  readonly isAdmin = computed(() => this.login.currentUser()?.roleName === 'ADMIN');
  /** El reporte de auditoría solo se ofrece a ADMIN; la ruta además usa adminGuard. */
  readonly reports = computed(() => REPORTS.filter((report) => !report.adminOnly || this.isAdmin()));

  /** Trazos del icono de cada tipo de gráfico (24x24, mismo estilo que el sidebar). */
  readonly icons: Record<string, string> = {
    bar: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
    doughnut: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
    line: 'M4 20h16M4 16l5-6 4 3 7-8',
  };
}

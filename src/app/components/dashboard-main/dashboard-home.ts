import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { LoginService } from '../../services/login-service';
import { ClienteService } from '../../services/cliente-service';
import { WorkspaceIcon } from './workspace-icon';
import { DashboardQueriesComponent } from './dashboard-queries/dashboard-queries';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { I18nService } from '../../services/i18n.service';
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [RouterLink, WorkspaceIcon, DashboardQueriesComponent, ...I18N_PIPES],
  templateUrl: './dashboard-home.html',
  styleUrls: ['./dashboard-home.css', './dashboard-home-responsive.css'],
})
export class DashboardHomeComponent implements OnInit {
  readonly loginService = inject(LoginService);
  private readonly clients = inject(ClienteService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroy = inject(DestroyRef);
  private readonly i18n = inject(I18nService);
  clientCount: number | null = null;
  clientStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  readonly caseStates = [
    'home.stateOpen',
    'home.stateInProgress',
    'home.stateClosed',
    'home.stateArchived',
  ];
  get greeting(): string {
    const hour = new Date().getHours();
    const key =
      hour >= 6 && hour < 12 ? 'home.morning' : hour >= 12 && hour < 20 ? 'home.afternoon' : 'home.evening';
    return this.i18n.t(key);
  }
  get firstName(): string {
    return this.loginService.currentUser()?.fullName?.trim().split(/\s+/)[0] ?? '';
  }
  ngOnInit(): void {
    this.loadClients();
  }
  loadClients(): void {
    if (this.clientStatus === 'loading') return;
    this.clientStatus = 'loading';
    this.clientCount = null;
    this.clients
      .list()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (rows) => {
          this.clientCount = rows.length;
          this.clientStatus = 'ready';
          this.cd.markForCheck();
        },
        error: () => {
          this.clientStatus = 'error';
          this.cd.markForCheck();
        },
      });
  }
}

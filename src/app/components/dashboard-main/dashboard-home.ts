import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { LoginService } from '../../services/login-service';
import { ClienteService } from '../../services/cliente-service';
import { WorkspaceIcon } from './workspace-icon';
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [RouterLink, WorkspaceIcon],
  templateUrl: './dashboard-home.html',
  styleUrls: ['./dashboard-home.css', './dashboard-home-responsive.css'],
})
export class DashboardHomeComponent implements OnInit {
  readonly loginService = inject(LoginService);
  private readonly clients = inject(ClienteService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroy = inject(DestroyRef);
  clientCount: number | null = null;
  clientStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  readonly caseStates = ['Abiertos', 'En curso', 'Cerrados', 'Archivados'];
  get greeting(): string {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 12
      ? 'Buenos días'
      : hour >= 12 && hour < 20
        ? 'Buenas tardes'
        : 'Buenas noches';
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

import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UserResponse, RoleResponse } from '../../models/management';
import { UsuarioService } from '../../services/usuario-service';
import { RolService } from '../../services/rol-service';
import { LoginService } from '../../services/login-service';
import { ManagementHttpState } from '../../shared/management-http-state';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [FormsModule, RouterLink, ManagementDialogDirective, ...I18N_PIPES],
  templateUrl: './gestion-usuarios.html',
  styleUrls: [
    '../../shared/management.css',
    '../../shared/modern-module.css',
    './gestion-usuarios.css',
  ],
})
export class GestionUsuariosComponent extends ManagementHttpState<UserResponse> implements OnInit {
  private readonly api = inject(UsuarioService);
  private readonly roleApi = inject(RolService);
  private readonly login = inject(LoginService);
  users: UserResponse[] = [];
  roles: RoleResponse[] = [];
  ngOnInit() {
    this.load();
  }
  load() {
    if (this.loading || this.busy) return;
    this.users = [];
    this.roles = [];
    this.resetPage();
    this.run(
      forkJoin({ users: this.api.list(), roles: this.roleApi.list() }),
      'loading',
      (value) => {
        this.users = value.users;
        this.roles = value.roles;
      },
    );
  }
  get activeCount() {
    return this.users.filter((u) => u.status === 'ACTIVE').length;
  }
  get inactiveCount() {
    return this.users.filter((u) => u.status === 'INACTIVE').length;
  }
  get filtered() {
    const q = this.query.trim().toLocaleLowerCase();
    return this.users.filter(
      (u) =>
        (!this.filter || u.status === this.filter) &&
        (!this.secondaryFilter || String(u.roleId) === this.secondaryFilter) &&
        `${u.fullName} ${u.email}`.toLocaleLowerCase().includes(q),
    );
  }
  canDeactivate(user: UserResponse) {
    return (
      user.status === 'ACTIVE' &&
      user.roleName.toUpperCase() !== 'ADMIN' &&
      user.userId !== this.login.currentUser()?.userId
    );
  }
  openForm(user: UserResponse) {
    if (this.busy || this.loading) return;
    this.selected = null;
    this.run(this.api.get(user.userId), 'busy', (value) => (this.editing = { ...value }));
  }
  showDetail(user: UserResponse) {
    if (this.busy || this.loading) return;
    this.run(this.api.get(user.userId), 'busy', (value) => (this.selected = value));
  }
  save() {
    if (!this.editing || this.busy) return;
    const user = this.editing;
    this.run(
      this.api.update(user.userId, { fullName: user.fullName, email: user.email }),
      'busy',
      (value) => {
        this.users = this.users.map((u) => (u.userId === value.userId ? value : u));
        this.editing = null;
        this.resetPage();
        this.notice = 'Usuario actualizado correctamente.';
      },
    );
  }
  confirmDeactivate(user: UserResponse) {
    if (this.busy || this.loading || !this.canDeactivate(user)) return;
    this.error = '';
    this.pending = user;
  }
  deactivate() {
    if (!this.pending || this.busy || !this.canDeactivate(this.pending)) return;
    const id = this.pending.userId;
    this.run(this.api.deactivate(id), 'busy', () => {
      this.pending = null;
      this.users = this.users.filter((u) => u.userId !== id);
      this.resetPage();
      // Leer la respuesta definitiva sin inventar updatedAt ni otros campos.
      this.run(
        this.api.list(),
        'loading',
        (rows) => {
          this.users = rows;
          this.notice = 'Usuario desactivado correctamente.';
        },
        () => (this.users = []),
      );
    });
  }
  @HostListener('document:keydown.escape') dismiss() {
    this.close();
  }
}

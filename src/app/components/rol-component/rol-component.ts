import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { RoleResponse, UserResponse } from '../../models/management';
import { RolService } from '../../services/rol-service';
import { UsuarioService } from '../../services/usuario-service';
import { ManagementHttpState } from '../../shared/management-http-state';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
@Component({
  selector: 'app-rol',
  standalone: true,
  imports: [FormsModule, ManagementDialogDirective],
  templateUrl: './rol-component.html',
  styleUrls: ['../../shared/management.css', './rol-component.css'],
})
export class RolComponent extends ManagementHttpState<RoleResponse> implements OnInit {
  private readonly api = inject(RolService);
  private readonly userApi = inject(UsuarioService);
  roles: RoleResponse[] = [];
  users: UserResponse[] | null = null;
  detail = false;
  readonly permissions = [
    { resource: 'Perfil propio: GET /api/users/me', requirement: 'Usuario activo autenticado' },
    { resource: 'Clientes y expedientes', requirement: 'Usuario activo autenticado y propietario' },
    { resource: 'Administración de usuarios', requirement: 'ROLE_ADMIN' },
    { resource: 'Gestión de roles', requirement: 'ROLE_ADMIN' },
    { resource: 'Auditoría: /api/audit-logs', requirement: 'ROLE_ADMIN' },
  ];
  ngOnInit() {
    this.load();
  }
  load() {
    if (this.loading || this.busy) return;
    const id = this.selected?.roleId;
    this.roles = [];
    this.users = null;
    this.selected = null;
    this.run(
      forkJoin({
        roles: this.api.list(),
        users: this.userApi.list().pipe(catchError(() => of(null))),
      }),
      'loading',
      (value) => {
        this.roles = value.roles;
        this.users = value.users;
        this.selected = this.roles.find((r) => r.roleId === id) ?? this.roles[0] ?? null;
      },
    );
  }
  count(role: RoleResponse) {
    return this.users === null ? null : this.users.filter((u) => u.roleId === role.roleId).length;
  }
  fundamental(role: RoleResponse) {
    return ['ADMIN', 'USER'].includes(role.name.toUpperCase());
  }
  lockedName(role: RoleResponse) {
    return !!role.roleId && (this.fundamental(role) || this.count(role) !== 0);
  }
  canRemove(role: RoleResponse) {
    return !this.fundamental(role) && this.count(role) === 0;
  }
  choose(role: RoleResponse) {
    if (!this.busy) this.selected = role;
  }
  showDetail(role: RoleResponse) {
    if (this.busy || this.loading) return;
    this.run(this.api.get(role.roleId), 'busy', (value) => {
      this.selected = value;
      this.detail = true;
    });
  }
  openForm(role?: RoleResponse) {
    if (this.busy || this.loading) return;
    this.error = '';
    this.detail = false;
    if (role) this.run(this.api.get(role.roleId), 'busy', (value) => (this.editing = { ...value }));
    else this.editing = { roleId: 0, name: '', description: '' };
  }
  save() {
    if (!this.editing || this.busy) return;
    const role = this.editing;
    const body = { name: role.name, description: role.description || null };
    this.run(
      role.roleId ? this.api.update(role.roleId, body) : this.api.create(body),
      'busy',
      (value) => {
        this.roles = role.roleId
          ? this.roles.map((r) => (r.roleId === value.roleId ? value : r))
          : [...this.roles, value];
        this.selected = value;
        this.editing = null;
        this.notice =
          'Rol guardado correctamente. Sus accesos dependen de las reglas del servidor.';
      },
    );
  }
  confirmRemove(role: RoleResponse) {
    if (this.busy || this.loading || !this.canRemove(role)) return;
    this.error = '';
    this.pending = role;
  }
  remove() {
    if (!this.pending || this.busy || !this.canRemove(this.pending)) return;
    const id = this.pending.roleId;
    this.run(this.api.remove(id), 'busy', () => {
      this.roles = this.roles.filter((r) => r.roleId !== id);
      this.selected = this.roles[0] ?? null;
      this.pending = null;
      this.detail = false;
      this.notice = 'Rol eliminado correctamente.';
    });
  }
  @HostListener('document:keydown.escape') override close() {
    if (this.busy) return;
    this.detail = false;
    this.editing = null;
    this.pending = null;
    this.error = '';
  }
}

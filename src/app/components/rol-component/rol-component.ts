import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { RoleResponse, UserResponse } from '../../models/management';
import { RolService } from '../../services/rol-service';
import { UsuarioService } from '../../services/usuario-service';
import { ManagementHttpState } from '../../shared/management-http-state';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
import { I18N_PIPES } from '../../shared/i18n/i18n.pipes';
import { I18nService } from '../../services/i18n.service';
@Component({
  selector: 'app-rol',
  standalone: true,
  imports: [FormsModule, ManagementDialogDirective, ...I18N_PIPES],
  templateUrl: './rol-component.html',
  styleUrls: [
    '../../shared/management.css',
    '../../shared/modern-module.css',
    './rol-component.css',
  ],
})
export class RolComponent extends ManagementHttpState<RoleResponse> implements OnInit {
  private readonly api = inject(RolService);
  private readonly userApi = inject(UsuarioService);
  private readonly i18n = inject(I18nService);
  roles: RoleResponse[] = [];
  users: UserResponse[] | null = null;
  detail = false;
  readonly permissions = [
    { resource: 'roles.permProfile', requirement: 'roles.reqActive' },
    { resource: 'roles.permClients', requirement: 'roles.reqOwner' },
    { resource: 'roles.permUsers', requirement: 'roles.reqAdmin' },
    { resource: 'roles.permRoles', requirement: 'roles.reqAdmin' },
    { resource: 'roles.permAudit', requirement: 'roles.reqAdmin' },
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
        this.notice = this.i18n.t('roles.savedNotice');
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
      this.notice = this.i18n.t('roles.deletedNotice');
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

import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ClientResponse, ClientRequest, ClientCaseResponse } from '../../models/management';
import { ClienteService } from '../../services/cliente-service';
import { ManagementHttpState } from '../../shared/management-http-state';
import { ManagementDialogDirective } from '../../shared/management-dialog.directive';
@Component({
  selector: 'app-cliente',
  standalone: true,
  imports: [FormsModule, ManagementDialogDirective],
  templateUrl: './cliente-component.html',
  styleUrls: [
    '../../shared/management.css',
    '../../shared/modern-module.css',
    './cliente-component.css',
  ],
})
export class ClienteComponent extends ManagementHttpState<ClientResponse> implements OnInit {
  private readonly api = inject(ClienteService);
  clients: ClientResponse[] = [];
  clientCases: ClientCaseResponse[] = [];
  ngOnInit() {
    this.load();
  }
  load() {
    if (this.loading || this.busy) return;
    this.clients = [];
    this.resetPage();
    this.run(this.api.list(), 'loading', (rows) => (this.clients = rows));
  }
  get naturalCount() {
    return this.clients.filter((c) => c.clientType === 'PERSON').length;
  }
  get filtered() {
    const q = this.query.trim().toLocaleLowerCase();
    return this.clients.filter(
      (c) =>
        (!this.filter || c.clientType === this.filter) &&
        `${c.fullNameOrCompany} ${c.documentNumber ?? ''} ${c.email ?? ''}`
          .toLocaleLowerCase()
          .includes(q),
    );
  }
  openForm(client?: ClientResponse) {
    if (this.busy || this.loading) return;
    this.error = '';
    this.selected = null;
    if (client)
      this.run(this.api.get(client.clientId), 'busy', (value) => (this.editing = { ...value }));
    else
      this.editing = {
        clientId: 0,
        clientType: 'PERSON',
        fullNameOrCompany: '',
        documentNumber: '',
        email: '',
        phone: '',
        address: '',
        createdAt: '',
        updatedAt: '',
      };
  }
  showDetail(client: ClientResponse) {
    if (this.busy || this.loading) return;
    this.clientCases = [];
    this.run(
      forkJoin({ client: this.api.get(client.clientId), cases: this.api.cases(client.clientId) }),
      'busy',
      (value) => {
        this.selected = value.client;
        this.clientCases = value.cases;
      },
    );
  }
  save() {
    if (!this.editing || this.busy) return;
    const c = this.editing;
    const request: ClientRequest = {
      clientType: c.clientType,
      fullNameOrCompany: c.fullNameOrCompany,
      documentNumber: c.documentNumber || null,
      email: c.email || null,
      phone: c.phone || null,
      address: c.address || null,
    };
    this.run(
      c.clientId ? this.api.update(c.clientId, request) : this.api.create(request),
      'busy',
      (value) => {
        this.clients = c.clientId
          ? this.clients.map((row) => (row.clientId === value.clientId ? value : row))
          : [...this.clients, value];
        this.editing = null;
        this.resetPage();
        this.notice = 'Cliente guardado correctamente.';
      },
    );
  }
  confirmRemove(client: ClientResponse) {
    if (this.busy || this.loading) return;
    this.error = '';
    this.pending = client;
  }
  remove() {
    if (!this.pending || this.busy) return;
    const id = this.pending.clientId;
    this.run(this.api.remove(id), 'busy', () => {
      this.clients = this.clients.filter((c) => c.clientId !== id);
      this.pending = null;
      this.page = Math.min(this.page, this.pages(this.filtered));
      this.notice = 'Cliente eliminado correctamente.';
    });
  }
  @HostListener('document:keydown.escape') dismiss() {
    this.close();
  }
}

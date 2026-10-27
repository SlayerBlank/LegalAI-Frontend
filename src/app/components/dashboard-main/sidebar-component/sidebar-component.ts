import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
const links=[['Dashboard','/dashboard'],['Clientes','/clientes'],['Expedientes','/expedientes'],['Documentos','/documentos'],['Asistente IA','/chat-ia'],['Borradores','/borradores'],['Resúmenes','/resumenes'],['Citaciones IA','/citaciones-ia'],['Usuarios','/gestionusuarios'],['Roles','/roles'],['Auditoría','/auditoria']];
@Component({ selector:'app-sidebar', imports:[RouterLink,RouterLinkActive], templateUrl:'./sidebar-component.html', styleUrl:'./sidebar-component.css' }) export class SidebarComponent { readonly open=input(false); readonly closeRequested=output<void>(); protected readonly links=links; }

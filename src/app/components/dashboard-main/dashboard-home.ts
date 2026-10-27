import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
const cards = [{ title:'Clientes', path:'/clientes' }, { title:'Expedientes', path:'/expedientes' }, { title:'Documentos', path:'/documentos' }, { title:'Asistente IA', path:'/chat-ia' }];
@Component({ selector:'app-dashboard-home', imports:[RouterLink], templateUrl:'./dashboard-home.html', styleUrl:'./dashboard-home.css' }) export class DashboardHomeComponent { protected readonly cards = cards; }

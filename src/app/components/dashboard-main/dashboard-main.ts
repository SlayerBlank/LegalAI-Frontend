import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar-component/navbar-component';
import { SidebarComponent } from './sidebar-component/sidebar-component';
@Component({ selector:'app-dashboard-main', imports:[RouterOutlet,NavbarComponent,SidebarComponent], templateUrl:'./dashboard-main.html', styleUrl:'./dashboard-main.css' }) export class DashboardMainComponent { sidebarOpen=false; }

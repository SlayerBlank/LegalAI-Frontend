import { Component, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../services/theme-service';
@Component({ selector:'app-navbar', imports:[RouterLink], templateUrl:'./navbar-component.html', styleUrl:'./navbar-component.css' }) export class NavbarComponent { readonly menuRequested=output<void>(); readonly theme=inject(ThemeService); }

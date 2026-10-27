import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme-service';
@Component({ selector:'app-landing-page', imports:[RouterLink], templateUrl:'./landing-pageComponent.html', styleUrl:'./landing-pageComponent.css' }) export class LandingPageComponent { readonly theme=inject(ThemeService); readonly year=new Date().getFullYear(); }

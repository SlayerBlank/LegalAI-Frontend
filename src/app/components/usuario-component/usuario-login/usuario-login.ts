import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../services/theme-service';
@Component({ selector:'app-usuario-login', imports:[ReactiveFormsModule,RouterLink], templateUrl:'./usuario-login.html', styleUrl:'./usuario-login.css' }) export class UsuarioLoginComponent { private readonly fb=inject(FormBuilder); readonly theme=inject(ThemeService); readonly form=this.fb.nonNullable.group({email:['',[Validators.required,Validators.email]],password:['',Validators.required]}); showPassword=false; message=''; submit():void{if(this.form.invalid){this.form.markAllAsTouched();return;}this.message='Formulario validado. La autenticación con LegalAI se integrará próximamente.';} }

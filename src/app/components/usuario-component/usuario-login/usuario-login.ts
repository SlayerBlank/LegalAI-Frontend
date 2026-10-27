import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LoginService } from '../../../services/login-service';
import { ThemeService } from '../../../services/theme-service';
import { NavigationHistoryService } from '../../../services/navigation-history.service';
import { LoginRequest } from '../../../models/request/login-request';

@Component({ selector:'app-usuario-login', imports:[ReactiveFormsModule,RouterLink], templateUrl:'./usuario-login.html', styleUrl:'./usuario-login.css' })
export class UsuarioLoginComponent {
  private readonly fb=inject(FormBuilder); private readonly router=inject(Router); private readonly loginService=inject(LoginService); private readonly navigationHistory=inject(NavigationHistoryService);
  readonly theme=inject(ThemeService); readonly form=this.fb.nonNullable.group({email:['',[Validators.required,Validators.email]],password:['',Validators.required]});
  showPassword=false; loading=false; message='';
  goBack(): void { this.navigationHistory.goBack(); }
  submit():void { if(this.form.invalid){this.form.markAllAsTouched();return;} this.loading=true; this.message=''; const request:LoginRequest=this.form.getRawValue(); this.loginService.login(request).subscribe({next:()=>{this.loading=false;void this.router.navigate(['/dashboard']);},error:(error:unknown)=>{this.loading=false;this.message=this.loginService.errorMessage(error,'No fue posible iniciar sesión.');}}); }
}

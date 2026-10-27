import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LoginService } from '../../../services/login-service';
import { ThemeService } from '../../../services/theme-service';
import { NavigationHistoryService } from '../../../services/navigation-history.service';
import { RegisterRequest } from '../../../models/request/register-request';

function matching(control: AbstractControl): ValidationErrors | null { return control.get('password')?.value===control.get('confirmPassword')?.value?null:{mismatch:true}; }
function maxUtf8Bytes(control: AbstractControl): ValidationErrors | null { return new TextEncoder().encode(String(control.value)).length<=72?null:{maxBytes:true}; }

@Component({ selector:'app-usuario-insert', imports:[ReactiveFormsModule,RouterLink], templateUrl:'./usuario-insert.html', styleUrl:'./usuario-insert.css' })
export class UsuarioInsertComponent {
  private readonly fb=inject(FormBuilder); private readonly router=inject(Router); private readonly loginService=inject(LoginService); private readonly navigationHistory=inject(NavigationHistoryService);
  readonly theme=inject(ThemeService); readonly form=this.fb.nonNullable.group({fullName:['',[Validators.required,Validators.maxLength(150)]],email:['',[Validators.required,Validators.email,Validators.maxLength(150)]],password:['',[Validators.required,Validators.minLength(8),Validators.maxLength(100),maxUtf8Bytes]],confirmPassword:['',Validators.required]},{validators:matching});
  loading=false; message='';
  goBack(): void { this.navigationHistory.goBack(); }
  submit():void { if(this.form.invalid){this.form.markAllAsTouched();return;} this.loading=true;this.message='';const {fullName,email,password}=this.form.getRawValue();const request:RegisterRequest={fullName,email,password};this.loginService.register(request).subscribe({next:()=>{this.loading=false;void this.router.navigate(['/dashboard']);},error:(error:unknown)=>{this.loading=false;this.message=this.loginService.errorMessage(error,'No fue posible completar el registro.');}}); }
}

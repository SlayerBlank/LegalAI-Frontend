import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../services/theme-service';
function matching(control: AbstractControl): ValidationErrors | null { return control.get('password')?.value===control.get('confirmPassword')?.value?null:{mismatch:true}; }
@Component({ selector:'app-usuario-insert', imports:[ReactiveFormsModule,RouterLink], templateUrl:'./usuario-insert.html', styleUrl:'./usuario-insert.css' }) export class UsuarioInsertComponent { private readonly fb=inject(FormBuilder); readonly theme=inject(ThemeService); readonly form=this.fb.nonNullable.group({name:['',Validators.required],email:['',[Validators.required,Validators.email]],password:['',Validators.required],confirmPassword:['',Validators.required]},{validators:matching}); message=''; submit():void{if(this.form.invalid){this.form.markAllAsTouched();return;}this.message='Registro validado. La integración con LegalAI se encuentra pendiente.';} }

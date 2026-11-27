import { Component, input } from '@angular/core';
import { PublicHeader } from './public-header';
import { I18N_PIPES } from '../i18n/i18n.pipes';
@Component({
  selector: 'app-public-auth-frame',
  standalone: true,
  imports: [PublicHeader, ...I18N_PIPES],
  templateUrl: './public-auth-frame.html',
  styleUrls: ['./public-tokens.css', './public-auth-frame.css'],
})
export class PublicAuthFrame {
  readonly pathLabel = input.required<string>();
}

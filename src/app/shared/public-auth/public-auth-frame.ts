import { Component, input } from '@angular/core';
import { PublicHeader } from './public-header';
@Component({
  selector: 'app-public-auth-frame',
  standalone: true,
  imports: [PublicHeader],
  templateUrl: './public-auth-frame.html',
  styleUrls: ['./public-tokens.css', './public-auth-frame.css'],
})
export class PublicAuthFrame {
  readonly pathLabel = input.required<string>();
}

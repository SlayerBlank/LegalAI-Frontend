import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
} from '@angular/core';
@Directive({ selector: '[managementDialog]', standalone: true })
export class ManagementDialogDirective implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previous = document.activeElement as HTMLElement | null;
  private elements() {
    return Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      ),
    );
  }
  ngAfterViewInit() {
    this.elements()[0]?.focus();
  }
  ngOnDestroy() {
    if (this.previous?.isConnected) this.previous.focus();
  }
  @HostListener('keydown', ['$event']) onKey(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = this.elements();
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}

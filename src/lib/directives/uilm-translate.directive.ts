import {
  Directive,
  effect,
  EmbeddedViewRef,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';

import { UilmStore } from '../uilm-store';

/**
 * Structural directive that provides a translation function to the template.
 * Re-renders when the active language or translations change.
 *
 * @example
 * ```html
 * <section *uilmTranslate="let t">
 *   <p>{{ t('dashboard.LABEL.TITLE') }}</p>
 * </section>
 * ```
 *
 * With scope (auto-prefixes keys):
 * ```html
 * <section *uilmTranslate="let t; scope: 'dashboard'">
 *   <p>{{ t('LABEL.TITLE') }}</p>  <!-- resolves to dashboard.LABEL.TITLE -->
 * </section>
 * ```
 */
@Directive({
  selector: '[uilmTranslate]',
  standalone: true,
})
export class UilmTranslateDirective {
  private readonly store = inject(UilmStore);
  private readonly templateRef = inject(TemplateRef<UilmTranslateContext>);
  private readonly vcr = inject(ViewContainerRef);
  private viewRef: EmbeddedViewRef<UilmTranslateContext> | null = null;

  /** Optional scope prefix */
  readonly uilmTranslateScope = input<string>('');

  constructor() {
    effect(() => {
      this.store.activeLang();
      this.store.version();
      const isReady = this.store.ready();

      if (isReady) {
        this.ensureView();
      } else {
        this.vcr.clear();
        this.viewRef = null;
      }
    });
  }

  private ensureView(): void {
    const scope = this.uilmTranslateScope();

    const translateFn = (key: string, params?: Record<string, unknown>): string => {
      const resolve = (k: string): string | null =>
        this.store.has(k) ? this.store.translate(k, params) : null;

      const result = scope ? (resolve(`${scope}.${key}`) ?? resolve(key)) : resolve(key);

      return result ?? key;
    };

    if (this.viewRef) {
      // Update context in-place — preserves DOM, focus, scroll, animation state
      this.viewRef.context.$implicit = translateFn;
      this.viewRef.context.uilmTranslate = translateFn;
      this.viewRef.markForCheck();
    } else {
      this.viewRef = this.vcr.createEmbeddedView(this.templateRef, {
        $implicit: translateFn,
        uilmTranslate: translateFn,
      });
    }
  }

  static ngTemplateContextGuard(
    _dir: UilmTranslateDirective,
    _ctx: unknown,
  ): _ctx is UilmTranslateContext {
    return true;
  }
}

interface UilmTranslateContext {
  $implicit: (key: string, params?: Record<string, unknown>) => string;
  uilmTranslate: (key: string, params?: Record<string, unknown>) => string;
}

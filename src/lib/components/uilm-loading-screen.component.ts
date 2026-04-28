import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, TemplateRef } from '@angular/core';

@Component({
  selector: 'uilm-loading-screen',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="uilm-loading-screen">
      @if (customTemplate()) {
        <ng-container *ngTemplateOutlet="customTemplate()!" />
      } @else {
        <div class="uilm-loading-content">
          <div class="uilm-loading-logo">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#6366f1" />
              <path
                d="M2 17l10 5 10-5"
                stroke="#6366f1"
                stroke-opacity="0.35"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M2 12l10 5 10-5"
                stroke="#6366f1"
                stroke-opacity="0.6"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <h2 class="uilm-loading-title">{{ title() }}</h2>
          <p class="uilm-loading-description">{{ description() }}</p>
          <div class="uilm-loading-bar">
            <div class="uilm-loading-bar-fill"></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .uilm-loading-screen {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #fff;
        z-index: 9999;
        animation: uilm-fade-in 0.3s ease-out;
      }

      .uilm-loading-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        text-align: center;
        padding: 32px;
      }

      .uilm-loading-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        animation: uilm-pulse 2s ease-in-out infinite;
      }

      .uilm-loading-title {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #374151;
        letter-spacing: -0.01em;
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
      }

      .uilm-loading-description {
        margin: 0;
        font-size: 1rem;
        color: #9ca3af;
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
      }

      .uilm-loading-bar {
        width: 180px;
        height: 3px;
        background: rgba(0, 0, 0, 0.06);
        border-radius: 3px;
        overflow: hidden;
        margin-top: 4px;
      }

      .uilm-loading-bar-fill {
        height: 100%;
        width: 40%;
        background: #6366f1;
        border-radius: 3px;
        animation: uilm-slide 1.4s ease-in-out infinite;
      }

      @keyframes uilm-fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes uilm-pulse {
        0%,
        100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.04);
          opacity: 0.85;
        }
      }

      @keyframes uilm-slide {
        0% {
          transform: translateX(-100%);
        }
        50% {
          transform: translateX(350%);
        }
        100% {
          transform: translateX(-100%);
        }
      }
    `,
  ],
})
export class UilmLoadingScreenComponent {
  readonly title = input('Loading');
  readonly description = input('Loading translations...');

  /**
   * Optional custom template to replace the entire default loading UI.
   *
   * @example
   * ```html
   * <ng-template #customLoading>
   *   <div class="my-loading">
   *     <img src="assets/logo.svg" />
   *     <p>Please wait...</p>
   *   </div>
   * </ng-template>
   *
   * <uilm-loading-screen [customTemplate]="customLoading" />
   * ```
   */
  readonly customTemplate = input<TemplateRef<unknown>>();
}

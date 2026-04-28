import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

import { BLOCKS_LOCALIZATION_CONFIG } from './tokens';
import { BlocksLocalizationConfig } from './types';
import { buildReverseMapping } from './utils/lang-codes';

/** Flat key → value translation map. */
export type TranslationMap = Record<string, string>;

/**
 * Core reactive translation store.
 *
 * Holds translations per language, tracks the active language via signals,
 * and persists language preference to `localStorage`.
 *
 * @publicApi
 */
@Injectable({ providedIn: 'root' })
export class UilmStore {
  private readonly config = inject<BlocksLocalizationConfig>(BLOCKS_LOCALIZATION_CONFIG);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storageKey = this.config.langStorageKey ?? 'uilmLang';

  /** Internal translation maps: `lang → flat key-value pairs` */
  private readonly store = new Map<string, TranslationMap>();

  /** Toggled on every `setTranslation` call to trigger signal reactivity. */
  private readonly _version = signal(0);
  private versionCounter = 0;

  /** Active language short code. */
  readonly activeLang = signal<string>(this.loadPersistedLang());

  /**
   * When `true`, `translate()` returns the raw key instead of the translated value.
   * Toggled via `window.postMessage({ action: 'keymode', keymode: true/false })`.
   * Useful for testing with a browser extension.
   */
  readonly keyMode = signal(false);

  /** Read-only version signal — depend on this to react to translation changes. */
  readonly version = this._version.asReadonly();

  /** `true` when translations have been loaded for the active language. */
  readonly ready = computed(() => {
    this._version();
    return this.store.has(this.activeLang());
  });

  constructor() {
    this.listenForKeyModeToggle();
  }

  /**
   * Translate a key for the active language.
   * Supports interpolation: `{{ name }}` in values is replaced by `params.name`.
   *
   * Returns the raw key if no translation is found.
   */
  translate(key: string, params?: Record<string, unknown>): string {
    this._version(); // touch so computed signals re-evaluate

    // In key mode, always return the raw key for debugging/testing
    if (this.keyMode()) return key;

    const translations = this.store.get(this.activeLang());
    let value = translations?.[key];

    if (value == null) return key;

    if (params) {
      value = value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, paramKey: string) => {
        const val = paramKey.split('.').reduce<unknown>((obj, k) => {
          if (obj != null && typeof obj === 'object' && !Array.isArray(obj)) {
            return (obj as Record<string, unknown>)[k];
          }
          return undefined;
        }, params);
        return val != null ? String(val) : match;
      });
    }

    return value;
  }

  /** Check if a translation key exists for the active language. */
  has(key: string): boolean {
    this._version();
    return this.store.get(this.activeLang())?.[key] != null;
  }

  /** Merge translations into the store for a given language. */
  setTranslation(data: TranslationMap, lang: string): void {
    const existing = this.store.get(lang) ?? {};
    this.store.set(lang, { ...existing, ...data });
    this.versionCounter = (this.versionCounter + 1) % 0x7fffffff;
    this._version.set(this.versionCounter);
  }

  /** Set active language and persist to `localStorage`. Ignores invalid language codes. */
  setActiveLang(lang: string): void {
    if (!this.config.availableLangs.includes(lang)) {
      console.warn(
        `[blocks-localization] "${lang}" is not in availableLangs [${this.config.availableLangs.join(', ')}]. Ignoring.`,
      );
      return;
    }
    this.activeLang.set(lang);
    this.persistLang(lang);
  }

  /** Get configured available languages. */
  getAvailableLangs(): string[] {
    return [...this.config.availableLangs];
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private getStorage(): Storage | null {
    try {
      const type = this.config.langStorage ?? 'localStorage';
      if (type === 'none') return null;
      return type === 'sessionStorage' ? sessionStorage : localStorage;
    } catch {
      return null;
    }
  }

  private loadPersistedLang(): string {
    try {
      const storage = this.getStorage();
      const stored = storage?.getItem(this.storageKey) ?? null;
      if (stored) {
        const reverse = this.config.localeMapping
          ? buildReverseMapping(this.config.localeMapping)
          : {};
        const shortCode = reverse[stored] ?? stored;
        if (this.config.availableLangs.includes(shortCode)) {
          return shortCode;
        }
      }
    } catch {
      // Storage unavailable (SSR, incognito restrictions, etc.)
    }
    return this.config.defaultLang;
  }

  private persistLang(lang: string): void {
    try {
      const storage = this.getStorage();
      if (!storage) return;
      const fullCode = this.config.localeMapping?.[lang] ?? lang;
      storage.setItem(this.storageKey, fullCode);
    } catch {
      // Storage unavailable
    }
  }

  /**
   * Listen for `window.postMessage` events to toggle key mode.
   *
   * Expected payload: `{ action: 'keymode', keymode: boolean }`
   *
   * Only messages from the same window and origin are accepted.
   * Toggling key mode bumps the version signal so all translated
   * values reactively update across the UI.
   */
  private listenForKeyModeToggle(): void {
    if (typeof window === 'undefined') return;

    const handler = (event: MessageEvent): void => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;

      const { data } = event;
      if (!data || typeof data !== 'object') return;

      const { action, keymode } = data as { action?: string; keymode?: boolean };
      if (action === 'keymode' && typeof keymode === 'boolean') {
        const previous = this.keyMode();
        this.keyMode.set(keymode);

        if (previous !== keymode) {
          this.versionCounter = (this.versionCounter + 1) % 0x7fffffff;
          this._version.set(this.versionCounter);
        }
      }
    };

    window.addEventListener('message', handler);
    this.destroyRef.onDestroy(() => window.removeEventListener('message', handler));
  }
}

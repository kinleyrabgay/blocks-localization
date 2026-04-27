# Contributing to @selisedev/blocks-localization

Thank you for contributing. This guide covers the development workflow, code standards, and how to submit changes.

---

## Getting started

```bash
# Clone and install
git clone <repo-url>
cd blocks-localization
npm install

# Verify the lib works
npm test
npm run build
npm run lint
```

---

## Development workflow

### 1. Create a branch

```bash
git checkout -b feat/your-feature main
```

Branch naming convention:

| Prefix | When |
|--------|------|
| `feat/*` | New feature |
| `fix/*` | Bug fix |
| `refactor/*` | Internal refactor |
| `docs/*` | Documentation only |

### 2. Make your changes

All library source lives in `src/`:

```
src/
  lib/
    components/               # UI components
    directives/               # Structural directives
    pipes/                    # Template pipes
    utils/                    # Pure utility functions
    lang-switcher.ts          # Language switching service
    provide-blocks-localization.ts  # Root provider
    provide-uilm-scope.ts     # Route-level provider
    tokens.ts                 # Injection tokens
    types.ts                  # Public types and interfaces
    uilm-indexeddb-cache.ts   # IndexedDB persistence layer
    uilm-loader.ts            # HTTP client + two-tier cache
    uilm-store.ts             # Reactive translation store
    uilm-translate.service.ts # Translation service for components
  testing/
    provide-blocks-localization-testing.ts  # Test helper
  index.ts                    # Public API barrel
```

### 3. Write tests

Every source file should have a corresponding `*.spec.ts` file next to it.

```bash
# Run tests
npm test

# Run a specific spec
npx vitest run --config vite.config.mts src/lib/uilm-loader.spec.ts

# Watch mode
npm run test:watch
```

**Test patterns used in this library:**

| What you're testing | Setup |
|---|---|
| Pure functions (utils) | Direct import, no TestBed |
| Services (store, loader) | `TestBed` + `provideBlocksLocalizationTesting()` |
| HTTP interactions | `TestBed` + `provideHttpClient()` + `provideHttpClientTesting()` |
| IndexedDB-dependent code | Provide `FakeIndexedDbCache` via DI override |

### 4. Lint

```bash
npm run lint
npm run lint:fix    # auto-fix
npm run format:check
```

### 5. Build

```bash
npm run build
```

Verify the dist output at `dist/`.

---

## Code standards

### TypeScript

- Strict mode enabled (`strict: true`)
- No `any` — use proper types or `unknown`
- All public APIs must have JSDoc with `@publicApi` tag
- Internal helpers use `@internal` tag or `private` visibility

### Angular

- Standalone components/directives/pipes only (no NgModules)
- Signal-based reactivity preferred over RxJS where possible
- `DestroyRef` + `takeUntilDestroyed` for subscription cleanup
- `providedIn: 'root'` for singleton services

### Naming

| Item | Convention | Example |
|------|-----------|---------|
| Service | `PascalCase` | `UilmLoader` |
| Directive | `camelCase` selector | `[uilmTranslate]` |
| Pipe | `camelCase` name | `uilmTranslate` |
| Config interface | `PascalCase` | `BlocksLocalizationConfig` |
| Type alias | `PascalCase` | `UilmCacheStorage` |
| File | `kebab-case` | `uilm-indexeddb-cache.ts` |

### Public API

All public exports go through `src/index.ts`. If you add a new public class, type, or function:

1. Export it from `src/index.ts`
2. Add it to the **Public API** table in `README.md`
3. Add JSDoc with usage example

### What NOT to do

- Don't add external dependencies without discussion
- Don't add NgModules (standalone only)
- Don't add `console.log` — use `prodMode` config flag for warnings
- Don't commit `.spec.ts` changes without verifying all 69+ tests pass

---

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add IndexedDB cache storage option
fix: handle expired TTL in L2 cache
refactor: extract fallback chain into separate method
docs: add caching architecture to README
test: add UilmLoader IndexedDB mode tests
chore: release v0.1.0
```

Keep the scope simple since this is a standalone repo.

---

## Pull request process

1. Ensure all checks pass locally:
   ```bash
   npm run lint
   npm test
   npm run build
   ```

2. Update documentation if you changed the public API:
   - `README.md` — usage docs, config table, public API table
   - `DEPLOYMENT.md` — if CI/CD pipeline changes
   - `CHANGELOG.md` — add entry under `[Unreleased]`

3. Open a PR targeting `main`

4. PR title should follow conventional commits format:
   ```
   feat: add configurable retry on API failure
   ```

5. Fill in the PR description:
   - What changed and why
   - How to test it
   - Screenshots if UI-related

6. Wait for CI to pass and get at least one review approval

---

## Adding a new feature (checklist)

- [ ] Implementation in `src/lib/`
- [ ] Types/interfaces in `types.ts` (if new config options)
- [ ] Export from `src/index.ts`
- [ ] Unit tests in `*.spec.ts` (aim for full coverage of the new code)
- [ ] All existing tests still pass
- [ ] JSDoc on public APIs
- [ ] `README.md` updated (config table, usage example, public API table)
- [ ] `CHANGELOG.md` entry under `[Unreleased]`
- [ ] Lint clean
- [ ] Build succeeds

---

## Troubleshooting

### Tests fail with "Cannot configure the test module"

You're calling `TestBed.configureTestingModule()` after the module was already instantiated. Add `TestBed.resetTestingModule()` in `beforeEach` when your describe blocks use different configs.

### Tests fail with "zone-testing.js is needed"

Don't use `fakeAsync` / `tick` — this lib uses `@analogjs/vitest-angular` which doesn't include Zone.js. Use `await flushMicrotasks()` (see `uilm-loader.spec.ts` for the pattern).

### Build fails with TS5103

The `ignoreDeprecations` value must match the TypeScript version. Check `npx tsc --version` and adjust accordingly.

### Import errors after adding a new file

Make sure to:
1. Export from `src/index.ts`
2. Use relative imports within the lib (not path aliases)

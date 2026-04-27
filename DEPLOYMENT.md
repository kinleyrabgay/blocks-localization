# Deployment Guide - @selisedev/blocks-localization

This document covers the full release lifecycle: CI/CD pipeline, manual publishing, versioning, and troubleshooting.

---

## CI/CD Pipeline

The library uses a GitHub Actions workflow at `.github/workflows/publish.yml`.

### Pipeline overview

```
push to main ──> lint ──┬──> build ──> publish ──> tag
                 test ──┘
```

| Job | Runs on | Duration | What it does |
|-----|---------|----------|-------------|
| **lint** | Parallel with test | ~30s | `npm run lint` + `npm run format:check` |
| **test** | Parallel with lint | ~30s | `npm test` - 69 tests across 8 spec files |
| **build** | After lint+test pass | ~45s | `npm run build:prod`, verifies dist, uploads artifact |
| **publish** | After build, main only | ~20s | Version bump, `npm publish`, git commit + tag, push |

### Triggers

| Trigger | When | Publishes? |
|---------|------|-----------|
| Push to `main` | Auto, if `src/**` or `package.json` changed | Yes (patch bump) |
| Manual dispatch | On-demand from Actions tab | Yes (choose patch/minor/major) |

### Concurrency

Runs are grouped by branch. A new push cancels any in-progress run on the same branch - no wasted CI minutes.

---

## Prerequisites

### 1. NPM_TOKEN secret

Add an npm access token with publish permissions for the `@selisedev` scope:

1. Go to [npmjs.com/settings/tokens](https://www.npmjs.com/settings/tokens)
2. Create a **Granular Access Token** with:
   - Packages: Read and write
   - Scope: `@selisedev`
3. In your GitHub repo: **Settings > Secrets and variables > Actions > New repository secret**
   - Name: `NPM_TOKEN`
   - Value: the token from step 2

### 2. npm scope (first-time only)

If the `@selisedev` scope doesn't exist on npm yet:

```bash
# Create the org on npmjs.com, then:
npm login --scope=@selisedev --registry=https://registry.npmjs.org
```

---

## Publishing

### Automatic (recommended)

Merge your PR to `main`. The pipeline runs automatically and publishes a **patch** version bump.

### Manual (for minor/major releases)

1. Go to **Actions** tab in GitHub
2. Select **"Publish @selisedev/blocks-localization"**
3. Click **"Run workflow"**
4. Choose:
   - **Branch**: `main`
   - **Version bump**: `patch` / `minor` / `major`
   - **Dry run**: check to test without publishing

### Local (emergency only)

```bash
# 1. Ensure clean state
git checkout main && git pull

# 2. Build
npm run build:prod

# 3. Bump version
npm version patch  # or minor/major

# 4. Sync version to dist
cd dist
npm version $(node -p "require('../package.json').version") --no-git-tag-version --allow-same-version

# 5. Publish
npm publish --access public

# 6. Commit & tag
cd ..
git add package.json
git commit -m "chore: release v$(node -p "require('./package.json').version")"
git tag "v$(node -p "require('./package.json').version")"
git push origin main --tags
```

---

## Versioning

The library follows [Semantic Versioning](https://semver.org/):

| Bump | When | Example |
|------|------|---------|
| **patch** | Bug fixes, internal refactors, doc updates | `0.0.1` -> `0.0.2` |
| **minor** | New features (backward-compatible) | `0.0.2` -> `0.1.0` |
| **major** | Breaking changes to public API | `0.1.0` -> `1.0.0` |

### What counts as a breaking change

- Removing or renaming a public export
- Changing the signature of `provideBlocksLocalization()` or `provideUilmScope()`
- Changing the `BlocksLocalizationConfig` interface in a non-backward-compatible way
- Dropping support for an Angular version listed in `peerDependencies`

### What does NOT count as breaking

- Adding new optional fields to `BlocksLocalizationConfig` (e.g. `cacheStorage`)
- Adding new exports
- Internal refactors that don't change public API
- Performance improvements

---

## Package contents

After `npm run build:prod`, the dist contains:

```
dist/
  package.json              # Published package manifest (version, peers, exports)
  README.md                 # Full documentation (auto-copied from source)
  selisedev-blocks-localization.d.ts   # Root type definitions
  index.d.ts                # Re-exported types
  esm2022/                  # ESM2022 modules (tree-shakeable)
    selisedev-blocks-localization.js
    lib/
      uilm-loader.js
      uilm-store.js
      uilm-indexeddb-cache.js
      uilm-translate.service.js
      lang-switcher.js
      provide-blocks-localization.js
      provide-uilm-scope.js
      tokens.js
      types.js
      components/
      directives/
      pipes/
      utils/
  lib/                      # Type declarations mirror
  testing/                  # Test helper types
```

### What's included

- ESM2022 modules with source maps
- Full TypeScript declarations (`.d.ts`)
- README.md with usage docs

### What's excluded

- Test files (`*.spec.ts`)
- Vitest/test infrastructure
- Source `.ts` files (only compiled output)

---

## Consuming the package

### Install

```bash
npm install @selisedev/blocks-localization
```

### Peer dependencies

The consumer must have these installed:

| Package | Version |
|---------|---------|
| `@angular/common` | `>=17.0.0` |
| `@angular/core` | `>=17.0.0` |
| `rxjs` | `>=7.0.0` |

### Minimum setup

```typescript
import { provideBlocksLocalization } from '@selisedev/blocks-localization';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBlocksLocalization({
      uilmApiBaseUrl: 'https://api.seliseblocks.com/uilm/v1',
      projectKey: 'YOUR_PROJECT_KEY',
      availableLangs: ['en', 'de'],
      defaultLang: 'en',
    }),
  ],
};
```

See `README.md` for full configuration options, caching setup, and API reference.

---

## Troubleshooting

### Pipeline fails at lint

```bash
npm run lint
npm run lint:fix    # auto-fix
npm run format:check
```

### Pipeline fails at test

```bash
npm test
# Run specific spec
npx vitest run --config vite.config.mts src/lib/uilm-loader.spec.ts
```

### Pipeline fails at build

```bash
npm run build:prod
# Check for TS errors
npx tsc -p tsconfig.lib.prod.json --noEmit
```

### npm publish fails with 403

- Verify `NPM_TOKEN` secret is set and not expired
- Verify the token has publish permissions for `@selisedev` scope
- Check if the version already exists: `npm view @selisedev/blocks-localization versions`

### npm publish fails with 402

- Scoped packages require a paid npm org OR `--access public`
- The pipeline already uses `--access public`

### Version conflict

If the version in `package.json` already exists on npm:

```bash
# Check published versions
npm view @selisedev/blocks-localization versions --json

# Manually set a higher version
npm version 0.1.0 --no-git-tag-version
```

### Build passes locally but fails in CI

- Check Node.js version matches (`NODE_VERSION: "24"` in workflow)
- Run `npm ci` locally to ensure lockfile is in sync

---

## Release checklist

Before a release, verify:

- [ ] All tests pass: `npm test`
- [ ] Lint clean: `npm run lint`
- [ ] Format clean: `npm run format:check`
- [ ] Build succeeds: `npm run build:prod`
- [ ] README.md is up to date with any new features
- [ ] Breaking changes are documented (if major bump)
- [ ] `package.json` peer dependencies are correct

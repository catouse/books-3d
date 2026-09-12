# Repository Guidelines

## Project Structure & Module Organization

林间绘本馆 is a local React, TypeScript, Three.js, and Vite application.

- `src/main.tsx` mounts React; `src/App.tsx` owns UI, story transitions, dialogs, and collection persistence.
- `src/scene.ts` owns the persistent Three.js world, models, picking, and animation; `src/audio.ts` handles Web Audio.
- `src/stories.ts` defines story content, four-scene sequences, quizzes, and rewards.
- `src/styles.css` contains responsive styles and shared design tokens; `DESIGN.md` documents visual and interaction conventions.
- `tests/` contains Playwright specs; `public/` holds static assets; `artifacts/` stores screenshots and audits. `dist/` is generated build output.

## Build, Test, and Development Commands

Use Node.js 22.12+ and npm with the existing `package-lock.json`.

- `npm ci`: install locked dependencies.
- `npm run dev`: start Vite; use the URL printed in the terminal.
- `npm run typecheck`: check strict TypeScript types without emitting files.
- `npm run build`: run TypeScript checks and create `dist/`.
- `npm run preview`: serve the production build locally.
- `npx playwright install chromium`: install the test browser.
- `npm test`: run browser tests, automatically starting or reusing Vite at `http://127.0.0.1:5174`.

## Coding Style & Naming Conventions

Follow existing two-space indentation, single-quoted TypeScript strings, semicolons, and ES module imports. Use PascalCase for components, classes, and types; camelCase for functions and variables; kebab-case for CSS classes. Keep reusable design values in `src/styles.css` variables. No ESLint or Prettier configuration is present; match surrounding code and run type checking.

## Testing Guidelines

Write behavioral Playwright tests in `tests/*.spec.ts` with descriptive test names. Chromium runs serially. Prefer accessible role locators and state assertions over fixed delays. Preserve coverage for story completion, repeated clicks, quizzes, persistence, keyboard/mobile interaction, and failure recovery. No numeric coverage threshold is configured.

Run type checking, the build, and tests for behavior changes. Inspect relevant desktop/mobile screenshots; failure evidence and HTML reports go under `artifacts/test-results/` and `artifacts/playwright-report/`.

## Interaction & Content Constraints

Keep visible copy and accessible names in Simplified Chinese. Preserve story IDs and `komorebi-treasures-v1` storage compatibility. Maintain one persistent canvas, guarded transitions, reduced-motion support, and native-button equivalents for scene interactions. Generate artwork and audio locally; start audio only after user interaction.

## Commit & Pull Request Guidelines

Use imperative subjects with a type prefix: `feat: add story interactions`, `test: cover page transitions`, or `docs: update contributor guidelines`. Keep changes focused. PRs should explain the problem and resulting behavior, link relevant issues, list validation performed, and include desktop/mobile screenshots for visual changes.

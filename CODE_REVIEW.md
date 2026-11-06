# Code readability and maintainability review

Reviewed 30 October 2026. Scope: the active React application in `react/react-app`, its tests and documentation; the legacy application was considered only for context. This is a maintainability review based on source inspection and automated checks, not a comprehensive functional, accessibility or security audit.

## Overall assessment

The application is understandable at the feature level, but increasingly difficult to change safely. The main issues are large components with several responsibilities, persistence rules spread across the application, a flat source directory, and a global stylesheet whose ownership and cascade are hard to trace. Some abstractions already work well: the controlled pickers, focused PDF and speech helpers, and the validated layout migration provide useful starting points. The goal should be clearer ownership and smaller cohesive units, not a generic framework or extracting every short function.

**Priority:** establish documentation and a clean lint baseline; clarify persistence ownership; split the largest feature components and CSS incrementally; then consolidate proven duplication. Preserve stored data and existing behavior throughout.

## Findings and recommendations

### 1. Persistence ownership is scattered — high priority

`src/Layout.tsx:102` knows individual keys for multiple features when removing a component, while those features construct and write the same keys themselves (for example `src/Psalter.tsx:18`, `src/Catechism.tsx:131`, and `src/SpeechPassage.tsx:202`). Adding a preference requires remembering cleanup elsewhere. Catechism also stores per-catechism index keys (`Catechism.tsx:131`), so review deletion behavior against those keys before changing it. Storage error handling and value validation vary between features.

Give each feature a small storage module with named key construction, reading/validation, writing and removal functions. Let layout call feature cleanup through a small explicit mapping. Document the keys and migrations; keep existing keys and legacy fallbacks compatible. Avoid a large universal storage abstraction. `layoutStorage.ts` is a useful example of validating unknown persisted input and retaining unknown entries.

### 2. Large components obscure feature boundaries — high priority

`SpeechPassage.tsx` (514 lines) combines HTML preparation, browser speech lifecycle, retries, position persistence, highlighting and controls; its long props declaration at line 14 makes its modes hard to understand. `PdfReader.tsx` (503 lines) combines document loading, rendering, navigation, persistence, reading modes and controls. `IntegratedSpeechPassage.tsx` (329 lines) coordinates data fetching, selection, persistence and playback. These sizes alone are not defects, but the number of independent responsibilities makes state transitions and cleanup difficult to follow.

Extract along behavioral boundaries: for example speech playback coordination and its controls, and PDF document/render lifecycle and reader controls. Keep state that must change together under one owner, define the hook or component contract explicitly, and avoid breaking complex asynchronous behavior into arbitrary fragments. Add behavior-focused tests before moving playback and cancellation logic. Consider separating distinct speech usage modes with clearer prop groups or wrappers only if that reduces the current contract.

### 3. CSS needs ownership and a deliberate cascade — high priority

`src/index.css` is 1,696 lines, around 28% of the lines in the top-level TypeScript, TSX and CSS files counted in this review. It contains global tokens and fonts, layout, reader, settings, PDF, pickers, sliders and psalter rules. Related rules occur far apart: picker rules start at line 1426, shared slider rules at 1516, and psalter rules at 1692. Some components intentionally reuse class names such as `speech-mini-player` in `Psalter.tsx:120`, so simply moving a block by its name can change multiple features. A commented-out rule remains near line 176.

Split by ownership, for example `styles/base.css`, `styles/layout.css`, shared controls/pickers, and feature styles for speech, PDF, settings and psalter. Keep tokens and genuinely shared styles global, and import files in an explicit order initially. Map selectors to their consumers and preserve cascade order, media queries, custom properties and portal styles during the move; a file split alone does not scope CSS. Remove dead rules only after checking usage. Compare key views at narrow and wide sizes, themes, dialogs and reduced-motion settings before and after. CSS Modules are optional for new isolated styles, not a prerequisite for a safe split.

### 4. Source navigation and naming need a feature map — medium priority

Nearly all application code is directly under `src/`, mixing UI, feature logic, persistence and integrations. Finding everything associated with PDF or speech requires knowing several filenames. A modest feature-oriented structure would help, for example:

```text
src/
  app/                 # entry point, layout and composition
  features/
    bible/             # passage reader and reference logic
    speech/            # playback, text and follow behavior
    pdf/               # reader, text extraction and storage
    catechism/
    psalter/
    notes/
    video/
    settings/
  components/          # truly shared controls, such as pickers and Menu
  styles/              # base and shared styles
```

This is a proposed destination, not a mandate to create every directory immediately. Move one feature at a time and keep related tests discoverable. Clarify names such as `IntegratedSpeechPassage` and `Component_t` (`Layout.tsx:14`); preserve serialized identifiers such as `passage2` unless a migration is explicitly designed.

### 5. Models and external data boundaries are inconsistent — medium priority

There are good typed boundaries, such as the `ComponentConfig` discriminated union and `unknown` parsing in `layoutStorage.ts`. Elsewhere, data shape, transformation, fetching and display are mixed: `Catechism.tsx:16–78` contains its entry type, book table, reference conversion and loader alongside its UI; `Psalter.tsx:8` defines a data shape but accepts fetched JSON without runtime validation. `IntegratedSpeechPassage.tsx:87` repeats a version shape rather than relying on a clearly shared API contract. `YouVersionAPI.ts` also has explicit `any` reported by lint.

Keep small UI-only types local; move reusable domain types and pure reference conversion next to their feature, and keep API response types and normalization at the integration boundary. Validate the fields the UI relies on when loading untrusted or persisted data, and expose useful loading/error outcomes. Do not create a separate model file for every component or assume TypeScript validates JSON at runtime.

### 6. Reuse the behavior that is actually shared — medium priority

`ListPicker` and `PassagePicker` both implement dialog opening, closing and backdrop handling (`ListPicker.tsx:34–43, 65–72`; `PassagePicker.tsx:43–52, 75–81`). Their differences in keyboard and portal event handling matter, so extract a small dialog primitive only after documenting those differences and verifying focus, Escape and backdrop behavior. `Psalter.tsx:42–56` and `IntegratedSpeechPassage.tsx:64–77` repeat header measurement; a focused hook could own observer setup and cleanup. Completion feedback and delayed advancement recur in Psalter, Catechism and the integrated reader; share only the common behavior once their navigation and cancellation requirements are understood.

The controlled pickers already separate selection from caller persistence, which is a sound abstraction. Do not force the different readers into one highly configurable component merely because they look similar.

### 7. Local readability and consistency — medium priority

`NoteBox.tsx` has obsolete commented code and conflicting historical comments around `applyState` (lines 19–21, 29–34, 53–61, 104–106). It derives editability through mutable refs during render rather than plainly deriving booleans from state. Several files use `let` for React state bindings, compact multiple actions onto one line, and mix semicolon and formatting conventions. `ListPicker.tsx:19` has a long signature and nested conditional rendering at lines 59–62. These are individually small but increase scanning effort.

Remove stale comments, use descriptive names and derived values, expand dense conditionals and JSX where it helps, and adopt a consistent formatter or documented style. Prioritize changes near real work rather than reformatting the entire repository in one noisy commit.

### 8. Agent and contributor discoverability — high priority

The root `README.md` describes an older Bible API and gives a React path that does not match the current nested location; `react/react-app/README.md` is the Vite template. Neither provides a current feature map, state ownership, storage schema, external integrations, or test command. An AI agent can search the code, but must reconstruct these conventions and cross-feature constraints each time; the large components and global CSS also increase the chance of missing a dependency.

Replace the template README with a short, current guide: exact working directory and commands, entry points, feature map, external data and assets, storage and migration rules, CSS ownership, and areas requiring browser verification. Explain the purpose of `legacy/` and update stale root links. A concise `AGENTS.md` can point to these facts and capture project-specific invariants, but should not duplicate the whole README or prescribe unnecessary process.

### 9. Checks and test discoverability — high priority

On this checkout, `npm run build` passed; Vite warned that the PDF reader chunk exceeds 500 kB. `node --test tests/*.test.mjs` passed all 9 reported test files. `npm run lint` failed with 50 errors and 5 warnings, including `prefer-const`, React hook rules and explicit `any`. Lint failures make it harder to distinguish a new regression from existing noise; hook findings deserve individual review rather than automatic suppression or blind fixes. The package has no `test` script, making the existing suite less discoverable.

Add a documented `npm test` command and restore a clean lint baseline in reviewable batches. Existing tests cover important speech, PDF and layout logic, but the suite list does not establish coverage of the UI and cross-feature interactions. Before major structural moves, add targeted checks for the behavior being moved, especially storage migration/deletion, dialog keyboard behavior and asynchronous playback; use browser-level checks where DOM, audio or CSS behavior matters.

## Suggested sequence

1. Update documentation and expose the existing test command; triage and clear lint findings without changing behavior accidentally.
2. Inventory storage keys and deletion/migration behavior, then introduce feature-owned storage boundaries with compatibility tests.
3. Split CSS while preserving selector order and verify representative screens and dialogs visually.
4. Extract and test one cohesive responsibility at a time from speech and PDF, then move related files into feature directories.
5. Consolidate demonstrated duplication and clean local naming/comments as the affected code is touched.

These changes can be delivered in small independent reviews. Avoid a simultaneous directory move, reformat and behavioral rewrite: it would make regressions and review harder to isolate.

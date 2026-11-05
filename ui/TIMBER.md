# Timber integration status

The UI (`src/App.tsx`, `src/components/TabStrip.tsx`, `src/views/*.tsx`) is written
against the real `@oaknorthbank/components` (Timber) API — not guessed. The
component names and prop shapes (`Button.Primary`, `Input.TextArea`, `Select`'s
`onChange={(option) => ...}`, `Surface rounded elevated`, `Typography.Heading`,
`colours` from `@oaknorthbank/components/theme`) were read directly from working
usage in `operations-dashboard/src` (e.g. `components/VerticalTabs.tsx`,
`components/StatusBadge.tsx`, `pages/PersonalSavings/Backoffice/CisaGenerator/CisaGenerator.tsx`),
not invented.

**This environment has no OakNorth npm registry auth**, so `npm install` here
fails on the private `@oaknorthbank/*` scope (confirmed: `E404` on
`@oaknorthbank/components`, not a code problem). `npx tsc -b --noEmit` confirms
every remaining error is "cannot find module" for the private packages and
`styled-components` — nothing else. The app has not run with real Timber
components rendered; only the API shapes have been verified against source.

To actually run this:
1. `npm install` from a machine with OakNorth's npm registry auth already
   configured (standard engineer setup, not something this session has or
   should have).
2. `npm run dev` as normal — no code changes should be needed.

If something doesn't compile once installed, it's most likely a prop-shape
mismatch against the installed version (`^1.9.1` was read from
`operations-dashboard/package.json` at the time of writing — check it still
matches).

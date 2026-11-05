---
description: This project uses the Timber Design System — load the timber-* skills when building UI or writing copy
---

This project uses the OakNorth Timber Design System (TDS). When building or modifying UI:

- Use components from `@oaknorthbank/components`
- Use icons and flags from `@oaknorthbank/graphics` — always imported individually by path (no barrel export)
- Use formatting, parsing, and hook utilities from `@oaknorthbank/utils`

- Load the `timber-design` skill before writing or changing UI.
- Load the `timber-copy` skill before writing or editing user-facing text.
- Load the `timber-components` skill for component props, icon and flag imports, or utility signatures.
- Load the `timber-migration` skill when migrating legacy UI code or tests to Timber.

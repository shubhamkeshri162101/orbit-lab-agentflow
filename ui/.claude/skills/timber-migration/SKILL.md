---
name: timber-migration
description: >
  Use when migrating legacy UI code or tests to the Timber Design System:
  replacing old component libraries, icons and styled-components patterns with
  @oaknorthbank/components, @oaknorthbank/graphics and @oaknorthbank/utils, or
  moving tests to accessible role-based queries and userEvent.
---

# Migrate to Timber

1. Pick the guide for the project. If its `package.json` dependencies include
   both `react-native` and `expo`, follow [the mobile guide](../../../node_modules/@oaknorthbank/components/docs/migration/mobile.md).
   Otherwise follow [the web guide](../../../node_modules/@oaknorthbank/components/docs/migration/web.md).
2. Migrate tests with [the testing guide](../../../node_modules/@oaknorthbank/components/docs/migration/testing.md).
3. For each Timber replacement, load `timber-components` for its exact props.
   Load `timber-design` for styling decisions and `timber-copy` for any text you
   rewrite.

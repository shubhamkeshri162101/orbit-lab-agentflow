---
name: timber-components
description: >
  Use when working with @oaknorthbank/components, @oaknorthbank/graphics or
  @oaknorthbank/utils: finding the right Timber component, its props, variants
  and accessibility behaviour, icon and flag import paths, or formatter, parser
  and hook signatures. When building UI, load it alongside timber-design, which
  covers how the UI should look.
---

# Timber components

Start with [the Timber reference](../../../node_modules/@oaknorthbank/components/docs/README.md). It covers the packages,
the component index, theming, graphics and utils. Then read the full page for
each component or utility you use: props, variants, accessibility notes and
usage examples are all there.

## Setup

Wrap the app root once in `TimberProvider`, and give it a theme with `Surface`.
The root is always `light` or `dark`. `bannerPrimary` and `bannerSecondary` are
only for surfaces inside a page, such as a banner or sub-section:

```tsx
import type { PropsWithChildren } from 'react'

import { Surface, TimberProvider } from '@oaknorthbank/components'

export const App = ({ children }: PropsWithChildren) => (
  <TimberProvider>
    <Surface theme="light" flex>
      {children}
    </Surface>
  </TimberProvider>
)
```

## Components

<!-- generated:component-index:start -->

- [Accordion](../../../node_modules/@oaknorthbank/components/docs/components/accordion.md)
- [Alert](../../../node_modules/@oaknorthbank/components/docs/components/alert.md)
- [Avatar (deprecated)](../../../node_modules/@oaknorthbank/components/docs/components/avatar.md)
- [Badge (deprecated)](../../../node_modules/@oaknorthbank/components/docs/components/badge.md)
- [Booleans](../../../node_modules/@oaknorthbank/components/docs/components/booleans.md)
- [Button](../../../node_modules/@oaknorthbank/components/docs/components/button.md)
- [Calendar](../../../node_modules/@oaknorthbank/components/docs/components/calendar.md)
- [CharacterCount](../../../node_modules/@oaknorthbank/components/docs/components/character-count.md)
- [Chart](../../../node_modules/@oaknorthbank/components/docs/components/chart.md)
- [Checklist](../../../node_modules/@oaknorthbank/components/docs/components/checklist.md)
- [Divider](../../../node_modules/@oaknorthbank/components/docs/components/divider.md)
- [DynamicForm](../../../node_modules/@oaknorthbank/components/docs/components/dynamic-form.md)
- [Flag](../../../node_modules/@oaknorthbank/components/docs/components/flag.md)
- [IconButton](../../../node_modules/@oaknorthbank/components/docs/components/icon-button.md)
- [Icon](../../../node_modules/@oaknorthbank/components/docs/components/icon.md)
- [InputGroup](../../../node_modules/@oaknorthbank/components/docs/components/input-group.md)
- [Input.Search](../../../node_modules/@oaknorthbank/components/docs/components/input-search.md)
- [Input](../../../node_modules/@oaknorthbank/components/docs/components/input.md)
- [Label](../../../node_modules/@oaknorthbank/components/docs/components/label.md)
- [Link](../../../node_modules/@oaknorthbank/components/docs/components/link.md)
- [List](../../../node_modules/@oaknorthbank/components/docs/components/list.md)
- [Logo](../../../node_modules/@oaknorthbank/components/docs/components/logo.md)
- [Modal](../../../node_modules/@oaknorthbank/components/docs/components/modal.md)
- [Pattern](../../../node_modules/@oaknorthbank/components/docs/components/pattern.md)
- [Picker](../../../node_modules/@oaknorthbank/components/docs/components/picker.md)
- [Pill](../../../node_modules/@oaknorthbank/components/docs/components/pill.md)
- [Portal](../../../node_modules/@oaknorthbank/components/docs/components/portal.md)
- [ProgressBar](../../../node_modules/@oaknorthbank/components/docs/components/progress-bar.md)
- [Progress](../../../node_modules/@oaknorthbank/components/docs/components/progress.md)
- [SegmentedControl](../../../node_modules/@oaknorthbank/components/docs/components/segmented-control.md)
- [Select](../../../node_modules/@oaknorthbank/components/docs/components/select.md)
- [Slider](../../../node_modules/@oaknorthbank/components/docs/components/slider.md)
- [Spinner](../../../node_modules/@oaknorthbank/components/docs/components/spinner.md)
- [StepIndicator](../../../node_modules/@oaknorthbank/components/docs/components/step-indicator.md)
- [Surface](../../../node_modules/@oaknorthbank/components/docs/components/surface.md)
- [TabMenu](../../../node_modules/@oaknorthbank/components/docs/components/tab-menu.md)
- [Text](../../../node_modules/@oaknorthbank/components/docs/components/text.md)
- [Toast](../../../node_modules/@oaknorthbank/components/docs/components/toast.md)
- [ToggleGroup](../../../node_modules/@oaknorthbank/components/docs/components/toggle-group.md)
- [Tooltip](../../../node_modules/@oaknorthbank/components/docs/components/tooltip.md)
- [Typography](../../../node_modules/@oaknorthbank/components/docs/components/typography.md)

<!-- generated:component-index:end -->

## Graphics

Icons, flags and brand graphics are in [the graphics reference](../../../node_modules/@oaknorthbank/graphics/docs/graphics.md).
Import icons and flags individually by path. There is no barrel export.

## Utils

Start with [the utils overview](../../../node_modules/@oaknorthbank/utils/docs/README.md), then the page for
the module you need:

<!-- generated:utils-index:start -->

- [Countries](../../../node_modules/@oaknorthbank/utils/docs/utils/countries.md)
- [Currencies](../../../node_modules/@oaknorthbank/utils/docs/utils/currencies.md)
- [Date Utilities](../../../node_modules/@oaknorthbank/utils/docs/utils/date.md)
- [formatter](../../../node_modules/@oaknorthbank/utils/docs/utils/formatter.md)
- [Hash](../../../node_modules/@oaknorthbank/utils/docs/utils/hash.md)
- [Hooks](../../../node_modules/@oaknorthbank/utils/docs/utils/hooks.md)
- [parser](../../../node_modules/@oaknorthbank/utils/docs/utils/parser.md)
- [Phone Codes](../../../node_modules/@oaknorthbank/utils/docs/utils/phone-codes.md)
- [Platform](../../../node_modules/@oaknorthbank/utils/docs/utils/platform.md)
- [Testing](../../../node_modules/@oaknorthbank/utils/docs/utils/testing.md)

<!-- generated:utils-index:end -->

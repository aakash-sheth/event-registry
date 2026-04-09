# EkFern Design Style Guide

This document defines the current design system standards for EkFern and how to use them consistently across host, invite, registry, and public marketing surfaces.

## Purpose

- Keep the UI cohesive across all product areas.
- Reduce one-off styling and duplicated visual decisions.
- Make design and engineering decisions predictable and reviewable.
- Improve accessibility, usability, and implementation quality.

## Product Identity

EkFern's visual direction is:

- **Warm and eco-conscious**: natural tones with calm contrast.
- **Modern and clear**: readable hierarchy, clean layout, minimal clutter.
- **Celebratory but intentional**: visual warmth without visual noise.

## Source of Truth (Current Implementation)

Primary implementation files:

- `frontend/tailwind.config.ts`
- `frontend/app/globals.css`
- `frontend/lib/utils.ts`
- `frontend/components/ui/*`
- Invite theming:
  - `frontend/lib/invite/themes.ts`
  - `frontend/components/invite/living-poster/ThemeProvider.tsx`

When style decisions conflict, resolve in this order:

1. This guide
2. Shared UI primitives in `frontend/components/ui/`
3. Tailwind tokens/config
4. Feature-level component classes

## Design Tokens

Use semantic tokens whenever possible. Avoid hardcoded hex values in page components unless there is a strong, documented reason.

### Core Color Tokens

Defined in `tailwind.config.ts` and/or `globals.css`:

- `bg-eco-beige` / `#F5F5DC`
- `text-eco-green` / `#4CAF50`
- `bg-eco-green-light` / `#A5D6A7`
- `background` (`--background`)
- `foreground` (`--foreground`)

Extended palette currently used in public/marketing pages:

- `pastel-green`
- `bright-teal`
- `pastel-cream`
- `bright-coral`
- `pastel-blue`
- `forest-green`
- `sunshine-yellow`
- `earth-brown`

### Token Usage Rules

- **Do** use semantic classes (`bg-eco-*`, `text-eco-*`, `border-eco-*`) first.
- **Do** prefer CSS variables for theme-able colors.
- **Do not** introduce new hardcoded hex values in page-level TSX without updating token definitions.
- **Do not** use similar but slightly different shades for the same semantic role.

## Typography

### Current Baseline

- Global body font is set in `globals.css`.
- Multiple display fonts are imported for invitation themes and expressive contexts.
- Invite theme fonts are controlled via `frontend/lib/invite/themes.ts`.

### Standards

- Use the default body font for application interfaces (host dashboard, forms, settings).
- Reserve decorative fonts for invitation/presentation surfaces only.
- Maintain clear visual hierarchy:
  - Page title: bold, high contrast.
  - Section title: medium/high emphasis.
  - Body: regular weight, readable spacing.
  - Meta/help text: smaller and lower contrast, still accessible.

## Spacing, Radius, and Elevation

### Spacing

- Use Tailwind spacing scale consistently (`p-4`, `gap-6`, etc.).
- Prefer repeated layout patterns:
  - Page wrappers: `container mx-auto px-4`
  - Vertical rhythm blocks: `space-y-*`
- Avoid custom pixel values unless needed for device/mock framing.

### Border Radius

- Default app primitives use medium-large rounded corners (`rounded-md`, `rounded-lg`).
- Keep radius consistent by component type:
  - Inputs/buttons: `rounded-md`
  - Cards/modals/panels: `rounded-lg` to `rounded-2xl` depending on context

### Shadows

- Default cards/panels: subtle elevation (`shadow-sm` or `shadow-md`).
- Interactive hover states: increase one elevation step only.
- Avoid stacking multiple heavy shadows in standard dashboard UI.

## Motion and Animation

Available custom animations are defined in `tailwind.config.ts`:

- `animate-float`
- `animate-float-reverse`
- `animate-fade-in-up`
- `animate-gradient-shift`
- `animate-scroll`

Rules:

- Use motion to support hierarchy and state transitions.
- Keep transition durations subtle and purposeful.
- Do not add continuous decorative animation to dense data interfaces.
- Respect reduced-motion expectations for critical interactions.

## Theming Model

## Global App Theming

- Global app uses `:root` variables in `globals.css`.
- Host/public surfaces primarily rely on eco palette classes.

## Invite Theming

- Invite theming is driven by:
  - Theme registry (`frontend/lib/invite/themes.ts`)
  - Runtime provider (`ThemeProvider.tsx`) with optional per-event overrides
- Theme values are exposed via CSS custom properties:
  - `--theme-bg`
  - `--theme-fg`
  - `--theme-primary`
  - `--theme-muted`
  - `--theme-overlay-opacity`
  - `--theme-font-title`
  - `--theme-font-body`

Rule: invitation-specific theme behavior should remain isolated from host dashboard styling.

## Component Standards

Use shared primitives from `frontend/components/ui/` before creating one-off structures.

### Required Primitives

- `Button`
- `Input`
- `Card` (`CardHeader`, `CardContent`, etc.)
- `Badge`
- `Tooltip`
- `ToastProvider` / `useToast`

### Usage Rules

- Prefer primitive props (`variant`, `size`) over repeated inline class combinations.
- Keep custom `className` overrides minimal and role-specific.
- If a pattern is reused in 3+ places, promote it to a shared component.

## Layout Patterns

### Page Shells

- Host pages should render within `HostShell`.
- Shared page sections should use consistent spacing and heading structure.

### Recommended Structure

- Page root: `min-h-screen` + semantic background.
- Content wrapper: `container mx-auto px-4 py-*`.
- Section blocks: `mb-*` and/or `space-y-*`.
- Cards for grouped data and actions.

## Accessibility Standards

Minimum requirements for all new UI work:

- Ensure visible focus states on interactive elements.
- Keep sufficient color contrast for text and controls.
- Use semantic HTML and proper labels for form inputs.
- Preserve keyboard navigability for menus, dialogs, and forms.
- Do not rely on color alone for status communication.

## Content and Voice

- Keep microcopy clear, concise, and action-oriented.
- Prefer user-facing language over internal implementation terms.
- Use positive, supportive tone aligned with celebration + sustainability.

## Implementation Do/Don't

### Do

- Reuse tokenized color classes and shared primitives.
- Keep layout predictable and responsive by default.
- Add feature-specific styles only when primitives are insufficient.
- Document new design decisions in this file when they are reusable.

### Don't

- Introduce random one-off colors, spacing, or font choices.
- Duplicate the same class patterns across many components.
- Build new controls from scratch when a primitive already exists.
- Mix invitation visual styles into core host workflow pages without intent.

## Contribution Workflow for UI Changes

When shipping UI updates:

1. Start with shared primitives and token classes.
2. Validate responsive behavior (mobile, tablet, desktop).
3. Validate keyboard/focus and contrast.
4. Confirm style consistency with nearby pages.
5. Update this guide if new reusable patterns/tokens are introduced.

## Known Gaps (Current State)

These are active improvement areas:

- Some pages still use heavy inline Tailwind with repeated style strings.
- Token definitions are split between Tailwind and global CSS.
- Typography rules are not yet fully normalized across all surfaces.
- No Storybook/design-site currently exists for visual component documentation.

## Next Standardization Milestones

- Consolidate all semantic color tokens in one documented token map.
- Expand primitive variants (e.g., button semantic states) to reduce per-page overrides.
- Introduce shared layout primitives (`PageContainer`, `SectionHeader`, etc.).
- Add visual regression/snapshot checks for key UI surfaces.

---

If you need to add a new reusable visual pattern, update this document in the same PR so implementation and design standards stay aligned.

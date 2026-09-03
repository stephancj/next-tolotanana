# Tolotanana Design System

## Direction

A restrained, light clinical workspace designed for rushed tablet use in bright mission environments. Information hierarchy comes from typography, spacing and rules, not decorative color.

## Color

- Canvas: `oklch(0.975 0.006 255)`
- Surface: `oklch(0.995 0.003 255)`
- Ink: `oklch(0.24 0.025 255)`
- Muted ink: `oklch(0.50 0.025 255)`
- Rule: `oklch(0.90 0.012 255)`
- Primary: `oklch(0.50 0.18 272)`
- Success: `oklch(0.53 0.12 155)`
- Warning: `oklch(0.62 0.13 75)`
- Danger: `oklch(0.52 0.17 25)`

Use semantic colors only for status and action. No decorative gradients.

## Typography

Geist Sans for all UI. Base size 16px on touch forms, 14px for dense tables, 12px only for secondary metadata. Headings use 700–800 weight, never decorative display styling.

## Spatial System

4px base grid. Standard page width 1440px, task forms 1200px, reading content 760px. Touch controls are at least 44px high. Sections use 24–32px vertical rhythm and 1px rules instead of nested cards.

## Components

- Buttons: 10px radius, clear text labels, visible focus ring.
- Inputs: 48px minimum height, neutral background, persistent labels.
- Surfaces: flat white with 1px border; shadow only for overlays.
- Status: icon + text + restrained tint, never color alone.
- Dialogs: semantic, keyboard closable, labelled, focus managed.
- Toasts: non-blocking, announced through live regions, optional undo/action.

## Motion

150–200ms state transitions only. No bounce, scale choreography or layout animation. Respect `prefers-reduced-motion`.

## Responsive

Tablet is the primary target. Replace wide tables with patient rows/cards below 900px. Planning offers focused-day mode. Sticky controls must preserve at least 60% of viewport height for content.

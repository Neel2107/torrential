# Design

How the app looks and behaves, as rules. Each rule names the shared piece that carries it; change the piece, never one copy.

## One system

- The same kind of thing looks and behaves the same everywhere. When something gets better in one place, it gets better in every place that does the same job, through the shared piece in `src/ui` or a token in `src/theme.ts`.
- Before adding UI, look for the piece that already does it. If none does, make one and move the existing copies onto it in the same change.

## Surfaces float

The owner likes floating surfaces, so they're the default for anything that sits over a screen.

- **The look** is the Android glass menu's (`modules/glass-menu-android`): a near-black fill (light on the Linen theme), a light rim, a 28 radius, a soft shadow below, and a dimmed screen behind. `surface` in `src/ui/Panel.tsx` holds these values.
- **Sheets float.** They sit 8 points in from the sides and above the bottom edge, with all four corners rounded (`src/ui/Sheet.tsx`). The player's sheets always use the dark version.
- **Dialogs and popovers are Panels:** `Panel`, `PanelHeading` and `PanelButtons`. The words sit on the left; the two choices are pills side by side below them, Cancel then the action, as iOS lays out its alert, and a destructive action is the menu's red. iOS uses the system alert itself (`ask()` in `src/ui/Ask.tsx`).
- **Menus are native.** A row's ··· is `MoreMenu`: the system menu on iOS, the glass menu on Android. Its long press is `ActionSheet`. Both take the same `RowAction[]` (`src/ui/RowMenu.tsx`).

## Pieces

| Job | Piece |
|---|---|
| Pick one of a set, go somewhere, do something | `OptionRow`, `NavRow`, `ActionRow` (`src/ui/Row.tsx`) |
| A sheet with pages | `Pages` and `PageHeader` (`src/ui/Pages.tsx`) |
| Ask before something can't be undone | `ask()` |
| Go back | `leave()` (`src/ui/leave.ts`) |
| Something appears, leaves or makes room | `appear`, `vanish`, `vanishDown`, `reflow` (`src/ui/presets.ts`); `rise(i)` for staggered entrances |
| Press | `Tap` (`src/ui/Tap.tsx`); `Button` for labelled actions |
| Nothing to show yet | `EmptyState` (`src/ui/EmptyState.tsx`) |
| One choice of a few, side by side (search scope, speed, sleep, subtitle look) | `Chip` (`src/ui/Chip.tsx`); `radio` inside a radio group |
| An on/off setting | `Toggle` (`src/ui/Toggle.tsx`): the iPhone's switch shape on both platforms, the system switch on iOS |
| A section's title over a screen's content | `SectionHeading` (`src/ui/SectionHeading.tsx`) |
| Long text cut to a few lines (synopses) | `MoreText` (`src/ui/MoreText.tsx`): the last line fades into "More"; never `numberOfLines`, whose ellipsis doubles a full stop |
| Text in a narrow column (poster captions) | `maxFontSizeMultiplier={DENSE_TEXT_SCALE}` so words never split |

## Motion

- Follow Emil Kowalski's `animate-expo` skill. Nothing used 100+ times a day animates: tab switches, list rows, typing.
- Surfaces enter by growing from 0.94 while fading in, and leave by fading straight out.
- Sheets change pages by easing to the new page's height while the old page fades out and the new one slides in from the side it comes from (`Pages`).
- Springs and curves come from `motion` in `src/theme.ts`.

## Words

- Say what happened and what to do, in plain words: "Couldn't reach your engine", not codes.
- Destructive titles name the thing ("Delete Interstellar?") and the message says what is lost or freed.
- "This phone" is the device in hand; "your computer" is the engine elsewhere.

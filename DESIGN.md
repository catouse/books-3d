---
version: alpha
colors:
  paper: "#f7f5ed"
  surface: "#fdfbf5"
  ink: "#39473d"
  muted: "#72786c"
  primary: "#53745b"
  primary-hover: "#3d5944"
  sage: "#e8eddf"
  border: "#dedfd3"
  gold: "#b9954f"
typography:
  display:
    fontFamily: "Songti SC, STSong, SimSun, Noto Serif CJK SC, serif"
    fontSize: "47px"
    lineHeight: "1.6"
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
    fontSize: "16px"
    lineHeight: "1.9"
rounded:
  panel: "18px"
  button: "25px"
  dialog: "22px"
spacing:
  unit: "4px"
  section: "44px"
  mobile-gutter: "24px"
components:
  primary-button:
    backgroundColor: "#53745b"
    textColor: "#fffdf5"
    rounded: "25px"
---

# 林间绘本馆

## Overview

A quiet children's library made of paper and pale wood, with real rounded miniature characters unfolding from a physical book. Audience: children aged 6–8, reading independently or with an adult at a desk or on a phone. The current user instruction requires Chinese throughout the site, preserving the brief’s soft colors, warm light, and connected movement. This is an interactive story product with a small editorial shell, not a marketing landing page.

The signature is a continuous spatial handoff: a cover on the shelf becomes a book on the reading table, and its paper world opens without replacing the canvas. Controls stay outside faces and illustrations. The five thematic books share the same state machine and component styles.

Simplified Chinese is the sole content locale (`zh-CN`), per the user’s language correction. Market jurisdiction is unspecified; this is a local reading experience with no accounts, commerce, identity input or remote user data. Use short, friendly Chinese sentences and natural Chinese punctuation. Cover illustrations, story copy, quizzes, controls, errors and accessible names follow the same language. Keep story IDs and the storage key unchanged so existing collections persist. No imitation cultural motifs. Local system fonts prevent external loading delays. No critical regulated copy exists.

Token ownership: `src/styles.css :root` is the runtime source; this document mirrors the accepted palette. `paper` → `--paper`; `surface` → `--surface`; `ink` → `--ink`; `muted` → `--muted`; `primary` → `--green`; `primary-hover` → `--green-dark`; `sage` → `--sage`; `border` → `--line`; `gold` → `--gold`. Buttons, narrative, dialogs, navigation and footer consume these shared variables. The 3D material palette has intentionally varied book-specific colors, not separate UI themes.

## Colors

Paper and sage connect the UI to the story materials. Forest green is the shared interaction color. Ocean blue, peach, autumn ochre and rainy sage are book category colors only. Soft gold identifies light and earned treasures. All five reading views retain the same neutral shell. Normal text uses ink; captions use muted green-gray. Focus uses a solid primary outline and spacing. No color-only correctness feedback.

## Typography

Chinese Songti display type is justified by the actual printed-book subject. Use it only for the library name, headline, compact reader title and dialog title. Chinese system sans-serif fonts are used for narration and controls. Immersive narrative is 18px/1.8 (16px mobile); small secondary metadata is deliberately quieter and never contains the only action instructions. Do not italicize Chinese. Chinese wrapping is natural; no forced headline line breaks. Native system fonts keep initial positions stable.

## Layout

Desktop shelf header has the library name left, quiet navigation center, collection and sound right. A centered title introduces a substantial live 3D shelf. Five covers share one row on desktop; at 760px and below they occupy two physical shelves, three above and two centered below. Book names beneath the scene follow the same order, with a five-column desktop grid and a centered three-plus-two mobile grid. Cover sizes animate to the full reading size during flight. Book names are accessible selection controls. A restrained explainer strip ends the shelf page.

Opening a book expands the persistent room to `100dvh`. Hide the site header, introduction, explainer, footer and collection entry throughout reading, quiz and reward. Keep only a compact toolbar (return, story title, progress, sound), the live scene and a separate bottom story dock. The canvas fills all space above the dock; no text or controls cover character faces. The reading camera reserves 76px above the scene, 64px on phones and 52px in short landscape viewports.

The shelf app is at most 1600px wide with an 1180px stage. Immersive reading uses the full viewport width and a maximum 1120px narrative. At 760px narration stacks below the canvas and the toolbar uses compact controls with Chinese accessible names. Short landscape uses a horizontal narrative row to protect stage height. The document owns scrolling on the shelf and locks during reading; the story dock scrolls internally if content exceeds 42dvh (45dvh in short landscape), as do dialogs within `100dvh - 36px`. Returning restores the shelf scroll position and focuses the selected book.

## Elevation & Depth

Depth belongs mainly to Three.js geometry, contact shadows, book thickness and hinged pages. Static content avoids floating card boxes. Dialogs alone have a substantial paper shadow. A very low opacity grain overlays the page without intercepting events.

## Shapes

Rounded book edges and sphere-based characters are echoed by pill actions and rounded dialog corners. Flat hairline rules divide semantic regions. The illustration stage has no bounding card or decorative window chrome.

## Components

### Shared states

`App.tsx` owns the shared story lifecycle. Native buttons have hover, pressed, keyboard focus and disabled presentation. One `Modal` uses the native dialog focus trap, app-owned surface, Escape handling, inert background and focus restoration. The canonical live feedback region is `.story-content`; status messages describe transitions.

### Canonical owners

| Capability | Owner | Source | Verification |
|---|---|---|---|
| Story transitions | App.tsx state ref + StoryWorld animation guards | User brief, README lifecycle | Four-scene Playwright flows, repeated clicks |
| Immersive room | App.tsx resizeStage + styles.css is-immersive + StoryWorld.setImmersive | User request for a larger story stage | Desktop, portrait, landscape; persistent canvas and scroll restoration |
| Buttons | styles.css primary-button and interaction-button | DESIGN.md | Desktop, keyboard, mobile taps |
| Dialog | App.tsx Modal | Native HTML dialog + paper surface | Help and collection Escape/focus |
| Scrollbar | styles.css global scrollbar rules | DESIGN.md | Narrow screenshots and overflow checks |
| Feedback | App.tsx story-content live region | User click progression | Wrong/correct quiz, retry, reward |
| Storage | App.tsx guarded localStorage | Local-only collection | Reload preserves reward |
| Narrative actions | stories.ts actions + App.tsx step + StoryWorld props | Story-specific clues, choices and consequences | Canvas/button parity, sequential path, persistent visual results |

### Storytelling and keepsakes

Each four-scene story follows a concrete wish and obstacle, an unsuccessful attempt, a discovery or changed approach, and an ending that answers the opening through action. Keep each displayed passage to a few short Chinese sentences. Let props carry clues: a branch inside its shadow, sunlight falling on water, matching green ribbon ends, a bark ramp over a tree root, and a leaf umbrella lowered to shelter a smaller friend. Avoid concluding moral summaries and unrelated ladders, bridges or magic gifts.

Every action names its canvas target and describes its result in `stories.ts`. Only the current target advances the story; the native button performs the same action. Results remain visible until the next page. The forest path has three separately initiated steps, each moving the light before the rabbit follows; repeated clicks cannot skip a step or reveal later text.

The autumn book requires placing the bark before pushing the walnut; all three friends move together, and the shell opens into shared portions. The rain book shows a wet rabbit, lowers the umbrella, hands it over, then keeps it with the rabbit across the puddle. Walnut and umbrella props rest where placed rather than bobbing like the stars. Rain moves only when reduced motion is off.

The ending question invites causal recall, with a story-specific hint for another answer. Children may collect the bookmark without answering or after any answer. A bookmark is a keepsake of finishing the story, with a short reminder of its central moment; correctness never gates collection. Preserve existing story IDs and the storage key. Longer answer options stack on phones, and the story dock retains its internal scroll ownership.

### Motion

Continuous eased movement conveys story state. On entry, animate the actual canvas container dimensions over 540ms before the book flight, preserving WebGL proportions. Keep one canvas instance throughout. Freeze the original shelf layout across viewport expansion and keep it frozen through the closing and collapse animations. Page popups must collapse fully before the page turns; reveal begins after the turn. Rapid clicks are ignored while an operation owns the transition. Reduced motion removes ambient cursor trails and shortens sequential transitions. Ambient Web Audio begins only on a gesture, remains quiet, can be muted, and suspends when hidden.

### Iconography and content

Phosphor regular/duotone is the one UI icon family. A custom book brand mark and cover illustrations are identity/art, not a parallel control icon family. Every icon-only control has a Chinese accessible name. Book titles, narrative, quiz and reward names live in `src/stories.ts`. Each of the five books is complete; no unavailable or placeholder book is exposed.

## Do's and Don'ts

- Do preserve the same physical scene across shelf, reading and ending.
- Do keep every story action available through a native button as well as WebGL picking.
- Do use a stable narrative area below the characters.
- Don't add narration, speech synthesis, remote stock assets or autoplay before interaction.
- Don't mix loading placeholders with live book choices.
- Don't show a new popup while the previous page is turning.

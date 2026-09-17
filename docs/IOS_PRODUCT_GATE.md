# Radar → iOS Product Gate

A promising App Store signal is not yet a product. Use this gate when a weekly/daily research note promotes a candidate to BUILD.

## 1. Evidence before implementation

The opportunity issue must contain:

- concrete Job To Be Done;
- at least two evidence classes (for example chart persistence + reviews, or reviews + rating growth);
- exact dates and App Store app IDs;
- representative review IDs and short excerpts;
- current competitor/substitute check;
- explicit counter-evidence;
- why this is feasible for a small team;
- pricing hypothesis and a falsifiable validation target.

A one-day rank spike alone is WATCH.

## 2. Screen contract — required before UI code

Define:

- primary user goal;
- primary action;
- navigation model;
- loading / empty / populated / error / long-content states;
- destructive or irreversible actions;
- minimum supported iOS version;
- content-heavy, task-heavy, or media-heavy classification.

## 3. Apple-native implementation defaults

Follow `https://github.com/geekjourneyx/ios-native-design`.

- Native SwiftUI component first.
- Do not redraw system navigation/controls for novelty.
- Prefer SF Symbols for standard actions.
- Use semantic system colors and shared semantic tokens.
- Prefer Dynamic Type over fixed font sizes.
- Every interactive target exposes at least a 44×44 pt hit region.
- Respect safe areas, keyboard behavior, system sheets/navigation and accessibility semantics.
- Use one clear dominant primary action unless the flow requires otherwise.
- Motion must communicate state/continuity/feedback and remain understandable with Reduce Motion.
- Local-first/no-login is preferred when the product job does not require a server.

## 4. Runtime verification is P0

A BUILD is not design-complete because it compiles.

After material UI changes:

1. Build and launch the real app.
2. Drive the primary flow with the best available semantic tool; use Computer Use + Xcode/Device Hub when needed.
3. Inspect runtime accessibility semantics where available.
4. Capture Device Hub full-resolution screenshots at major checkpoints.
5. Check Light/Dark and at least one accessibility Dynamic Type size.
6. Check applicable small/large screen, keyboard, contrast, Reduce Motion, localization and permissions states.
7. Fix Blocker/Major findings and rerun the affected flow.
8. Encode stable critical paths as XCUI tests where practical.

## 5. 48-hour MVP format

Every new opportunity issue should try to reduce the first validation build to:

- one core job;
- one primary flow;
- 3–5 screens maximum unless the job genuinely requires more;
- native components and system behaviors;
- no account system unless required;
- no backend unless required;
- enough analytics/feedback to validate the hypothesis;
- one purchase hypothesis (for example ¥1 launch, low-cost buyout, or a clearly bounded IAP).

## 6. Kill criteria

Write kill criteria before development. Examples:

- cannot reproduce the claimed job gap after manual competitor testing;
- Apple already provides an adequate native solution;
- review evidence is caused by one temporary regression;
- required API/private entitlement makes App Store delivery unrealistic;
- acquisition depends on network effects or licensed content outside the experiment scope;
- paid intent disappears when tested with a landing page/TestFlight cohort.

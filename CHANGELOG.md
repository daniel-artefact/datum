# DATUM changelog

Each release is a file in Shopify Content > Files (datum-vN.js), set in the DATUM section's Script URL.
Rolling back = pasting the previous version's link.

## v2 (released 2026-11-25: datum-v2.js?v=1795643586)
- Tan sidewalls: once a dot on a wheel is placed by hand, the trace only looks within 5 mm of the outline through
  the dots and takes the edge nearest it. Before, the strong tan/black edge inside the tread pulled the trace up to
  11 mm inward even with the dots on the tread (test: tests/tanwall.py, brick-wall Ti bike; now within 1.5 mm).
- Setup tab trimmed: Photo (grade, side, Redo tires / Redo BB), then Scale, then Seat tube (straight / offset, no
  description). The Bottom bracket panel only shows inside the BB setup step. Camera details and How it works removed.
- Before you start is the final popup after the scale step (new copy: don't get lost in the numbers; transferring a
  fit between bikes is never exact, expect +/-10 mm), with Start / Go back.
- Tire trace quality judged in millimeters, not pixels (a sharper photo was judged harder): sized by a 700x30 tire
  (682 mm). Green: trace within 0.75 mm on average and the dot within 2.5 mm of the edge; yellow: 1.5 mm and 6 mm;
  red beyond. The same limits drive the dots, the Rear/Front labels and the photo check. Red dots now block OK.
- Locked steering axis controls: pressing and holding one shows the head tube guide lines and shakes it, with a note
  to unlock; it no longer moves (before, a locked control could still drag the axis line).
- Setup flow (Daniel's copy): start screen with why DATUM exists, signed - Daniel, then three oxide buttons: Demo: good edge detection, Demo: bad edge detection, Upload your photo (header button: Demos); after OK on each step the setup
  panel shows that step's info slide to read, then OK moves on (Back returns to the step): after the tires, a photo check (camera angle, tire outlines, front wheel,
  resolution, with advice); the chainring step explains finding the chainring's center, then a slide to check the
  BB carefully and why it isn't at the chainring's center (parallax); the scale step says it's only as accurate as your
  physical measurement, then a last slide on accuracy (+/-3 mm with good inputs, +/-10 mm in real life), signed
  - Daniel.
- Start screen: what DATUM is, then Upload your photo / Example: good edge detection / Example: bad edge detection.
  Nothing loads until the visitor picks. The header's three example buttons became one Examples button.
- Phones: pinch to zoom (two fingers zoom and pan; a point the first finger started moving goes back), bigger points,
  labels and grab areas for fingers, toolbar as one scrolling row above the photo, setup steps in a bar at the bottom,
  photo pinned to the top.
- Fit the photo when the photo area first gets its size (fixes the blank photo on the store page).
- Version shown in the footer.

## v1 (2026-11-25)
- First release on artefact.bike/pages/datum.

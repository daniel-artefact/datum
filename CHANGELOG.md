# DATUM changelog

Each release is a file in Shopify Content > Files (datum-vN.js), set in the DATUM section's Script URL.
Rolling back = pasting the previous version's link.

## v3 (in progress)
- Bike type, picked after choosing your photo: Road / Gravel / Mountain, and for Mountain, same size wheels or mixed
  (29 front, 27.5 rear). Also switchable in Setup > Photo, which retraces the tires.
- Knobby tires: the trace is fitted to the knob tips (the outermost edge in each slice of the wheel, slices about eight
  knob depths wide), not to every edge between knobs. Dots go on the knob tips.
- Limits per type (trace scatter for green / yellow; dot distance green / yellow; how far a placed dot is trusted):
  Road 0.75 / 1.5, 2.5 / 6, 5 mm. Gravel 1.25 / 2.5, 4 / 8, 6 mm. Mountain 2.25 / 4, 6 / 10, 8 mm. Random scatter
  over 50+ traced points moves the fitted diameter by about a tenth of the scatter.
- Mountain tire sizes (29 and 27.5, 2.2-2.6) using the same rule as the road list (OD = bead + 2 x width); default
  744 mm (29x2.4), gravel 702 mm. Mixed wheels: the rear is the front size less 38 mm, used in the camera solve and
  the scale; the tire picker sets the front. The 700c rim-lip size guess is skipped on mountain bikes.
- Side detection on mountain bikes accepts a single small ring (its cleanest circle can be under 100 mm); the test
  MTB photo was read as non-drive side before, which swapped the Rear / Front labels.
- Test: tests/mtb.py (Daniel's full-suspension photo, tests/photos/, kept out of git).
- Bike popup: no explainer under What kind of bike?; Mountain opens WHEELSIZE with Front and Rear toggles
  (32 / 29 / 27.5 / 26; beads 686 / 622 / 584 / 559). Mixed sizes replace the 29/27.5-only option: the rear tire is
  the front's width on its own rim. Same toggles in Setup > Photo.
- First guess sanity check: two circles only count as wheels if each is 6-32% of the photo's long side in radius,
  within 25% of each other in size, at about the same height and 1.15-2.5 diameters apart, and neither traces as
  'not found'. Otherwise the tire step starts with two see-through grey circles (Rear, Front) where wheels usually
  sit; drag the middle dot to move, the edge dot to size, then Trace. The left circle can't pass the right one.
  The stairs demo now starts this way. Each tire dot carries an R or F.
- Seat tube: offset by default on gravel and mountain (0 mm to start). The angle handle is now an arc like the
  steering axis. Padlocks for angle and offset: a locked handle shakes, shows the guide lines and doesn't move.
  EFF. STA only shows once HT top (the stack) has been placed.
- Steering axis start by type: road 72 deg / 47 mm offset, gravel 71 / 47, mountain 65 / 44 (start only).
  First HT bottom guess at the fork's axle to crown (mountain 560, or the picked fork's), HT top 115 above it.
- Fork axle to crown as a scale reference (mountain only): Setup > Scale > Fork A2C. Pick a fork (Cane Creek HELM
  MKII 29 at 130-160, 27.5 at 130-170, manufacturer spec) or enter it; Place crown shows the steering axis and HT
  bottom with an A2C line from the axle's foot. Counts at +/-6 mm. Picking a fork fills the fork offset if empty.

- Trace from the grey circles: outlines from 88% to 112% of each circle; the pair is picked together, sized by the
  wheel sizes (within 6%), by the dark-to-light step across the outline (tread inside, background outside). Before,
  a circle a little off could lock one tire onto grass or shadow (Daniel's MTB photo: rear 'not found').
- Continue anyway: the second time OK is refused on the tire outlines, a Continue anyway button appears. A tire that
  didn't trace then uses the outline through its five dots (shown as Check), and unplaced dots are taken as they are.

- Grey circles: no centre dot (people would fixate on the axle). Drag inside to move, drag the outline to size (the
  cursor shows which); no zoom window while doing either. Fill less see-through, outline bolder.
- Knobby hint: with Road picked, if both tires trace nearly all round but scattered 1.2-6 mm (knobs), the tire step
  says so with Switch to Mountain / Switch to Gravel.

- Fix: Reset photo reloaded your photo as Road (and 700c tire sizes); it now keeps the bike type and wheel sizes.
- The tire step names the bike type it is judging the tires as (e.g. Bike: Mountain, 29 front / 29 rear).

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

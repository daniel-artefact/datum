# Bike Photo Measure: handoff

Prototype of a tool that takes one side-on photo of a bike and returns bike-fit numbers (saddle and bar position relative to the bottom bracket) and, optionally, frame geometry. Built and tested on Nov 24, 2026 against a 58 cm ETERNA (ARTEFACT) with a known drawing and a known real-life fit.

Live prototype (owner-only until shared): https://claude.ai/artifact/HevBmDLMziFXN2sFCQWWvc
Note: the live page is one version behind this package. It still has the rim lip reference with a front-wheel bug (see "Open decisions"). This package is the tire-only version.

## Run it

Plain static files, no build step. The example photos are loaded with `fetch`, so serve the folder rather than opening the file directly:

```
cd src
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

| File | What it holds |
|---|---|
| `src/index.html` | Page markup and styles (six-step side panel, canvas stage, toolbar) |
| `src/app.js` | App state, pipeline, photo grade, scale fusion, Monte Carlo ±, drawing, UI |
| `src/core.js` | Pure math and computer vision, no DOM (also loads in Node: `require('./core.js')`) |
| `src/examples/tilted.jpg` | Test photo, camera about 17° off square (1333×2000) |
| `src/examples/dead-on.jpg` | Test photo, camera about 0.7° off square (2000×1333) |
| `experiments/rim-lip.js` | Fixed rim lip detector, not wired in (see Open decisions) |

## The flow (as the owner describes it)

1. **Photo check.** Finds both tires, solves the camera angle, flattens the photo to square-on and levels the ground. Grades the photo on camera angle, how readable the tire outlines are, whether the front wheel is turned, and resolution. A poor grade advises a retake; it does not switch detection off.
2. **Scale.** Something must be measured in real life. Three options, any combination: tire diameter (the lazy default), measured wheelbase (most accurate), the rider's own saddle height. Each entered value is shown against what the photo reads at the combined scale.
3. **Bottom bracket.** Found automatically as a circle on the chainring, with hand placement as the fallback. When the camera is not square, the BB is not at the center of the chainring circle (same reason axle ends look off-center); the tool corrects for it and says so. The depth used is hidden from the user.
4. **Seat tube angle.** Automatic from the seatpost and seat tube edges, marked "automatic" only at high confidence. If tracing fails or is low confidence: default 73.5°, marked "default", with Manual to override.
5. **Saddle and bar.** Three manual clicks: saddle nose, saddle rear, stem clamp center. Owner's decision: computer vision is not accurate enough for these. The magnifier shows a millimeter scale bar.
6. **Fit.** Practical: saddle height along the seat tube, saddle to stem clamp, drop, saddle tip behind BB. Technical: Sx, Sy (saddle) and Hx, Hy (stem clamp) from the BB. Toggles for saddle point (middle or nose) and drop to top of bar or bar center (bar Ø input, default 31.8).

Advanced and collapsed: frame geometry (stack, reach, head angle, seat angle, trail, BB drop, chainstay; needs two head tube clicks, optional fork offset from spec), and a prototype-only camera details panel. Free measuring is a toolbar tool on the image.

## How each part works

- **Tire outlines** (`core.detectWheels`, `core.fitWheel`): gradient-voted Hough finds two dark discs, then the outer tire edge is traced along 360 to 480 rays and fitted with a robust ellipse. Occluded stretches are rejected.
- **Camera solve** (`core.solveTilt`): two equal circles in one plane fix the camera. The squash of each ellipse gives the slant; the size difference between wheels gives perspective strength (focal length). Levenberg-Marquardt over (tilt x, tilt y, 1/focal), with a weak prior from EXIF focal length. The photo is then re-projected and rotated level (`core.buildRect`).
- **Scale** (`core.fitScale`): every reference gives its own mm per pixel; combined by weighted least squares using each reference's tolerance and pixel length. The four tire readings (across and upright, both wheels) share one tolerance group.
- **Out-of-plane correction** (`app.toBike`): a point that sits d mm toward the camera from the frame centerline appears shifted by d × tan(camera angle). Applied to the BB with d = 48 mm for the outer chainring, 70 mm for the crank bolt on non-drive-side photos.
- **Chainring** (`core.detectCrank`): concentric-evidence Hough in the corrected image, searched 350 to 480 mm ahead of the rear axle and 15 mm above to 95 mm below it, then a robust circle refit.
- **Seat tube** (`core.detectSeatTube`): slices across the expected tube every 5 mm, finds paired opposite edges 22 to 50 mm apart, fits a robust line, and reports the angle from the BB to the tube axis near its top.
- **Saddle top** (`app.silhouetteEdge`): where the seat tube line leaves the saddle's outline against the background, using color distance from the background. Works for dark or light saddles; fails if the saddle matches the wall.
- **Photo grade** (`app.gradePhoto`): camera angle <8° good, <20° usable; tire traced ≥50% good; front wheel turned judged by front-minus-rear out-of-round (<0.3% good, <0.8% usable, about 4° and 7° of steer); resolution <1 mm/px good, <2 usable. All thresholds are provisional guesses.
- **± values** (`app.runMC`): 200 reruns jiggling clicks (1 px; BB 2 px), axle centers, the camera solution and the scale.

## Reference data used for testing

ETERNA PROD L Drawing v11 (58 cm), from the owner's Drive: wheelbase 1007.7, chainstay 412, BB drop 75, stack 601.4, reach 390, head angle 72.7°, seat angle 74°, fork offset 47, trail 58.2. Tires 700×32c, about 686 mm nominal; the wheelbase implies about 684.5 mm as mounted.

Owner's real fit on that bike: saddle height 780 mm along the seat tube; saddle-to-bar 706 mm; drop 63 mm measured to the top of the bar clamp (≈79 mm to bar center, 32 mm bar).

## Accuracy findings

Results against the drawing and real fit (scale from tire + measured wheelbase; saddle and bar points reconstructed from the owner's clicks):

| | Reference | Tilted photo | Dead-on photo | App's ± |
|---|---|---|---|---|
| Chainstay (BB found automatically) | 412 | 409.8 | 412.6 | 3 |
| BB drop | 75 | 78.4 | 72.6 | 3 |
| Seat tube angle (automatic) | 74° | 74.7° | 74.1° | – |
| Saddle height | 780 | 782.5 | 779.4 | 4 |
| Saddle middle to stem clamp | 706 | 700.9 | 707.4 | 2.5 |
| Drop to top of bar | 63 | 71.8 | 67.9 | 2 |
| Saddle tip behind BB | – | 91.0 | 100.5 | 3.5 |
| Stack | 601.4 | 603.3 | 590.4 | 3.5 |
| Reach | 390 | 396.8 | 392.5 | 3.5 |

What this says:
- **Perspective correction works.** A 17° photo and a near-square photo agree within 1 to 3 mm on most numbers that don't involve the BB.
- **The stated ± is too small by 2 to 3×.** Realistic accuracy, which matches the owner's experience: about ±5 mm for numbers between two points (saddle to bar, drop, saddle height), about ±10 mm for anything measured from the BB (Sx, Sy, Hx, Hy, stack, setback).
- **The BB is the weak link.** The two photos place it about 6 mm apart vertically, and that error passes one-for-one into every BB-referenced number.
- **Seat tube angle matters less than it looks**: about 4 mm of saddle height per degree, since the line mostly slides along a near-flat saddle. Sx, Sy and saddle-to-bar don't use it.
- **Drop reads 5 to 9 mm high** in both photos against the owner's 63 mm. Unresolved; likely a difference in which saddle point the drop is taken from.
- **BB depth: 48 mm beats 70 mm for the chainring.** On the tilted photo, 70 mm gave chainstay 416.4 and saddle height 788.7 (vs 409.8 and 782.5 at 48). The owner's 70 mm is right for the crank arm/bolt, which is what's used on the non-drive side.
- **Saddle height as the only scale** reads the wheelbase at 1009 (dead-on) and 1002 (tilted): workable but the weakest reference, because it runs from the BB. It is also circular: the output saddle height is partly the input.
- **Trail is weak**: fork offset read from a photo was 52.7 against spec 47, pulling trail to 45.5 against 58.2. Use the spec offset field.

## Open decisions and next steps

1. **Rim lip as an extra scale reference: keep or drop?** The owner asked to remove it, then noted the front wheel was detected wrong. Both problems are understood:
   - Bug: the code took the brightest highlight inside the tire; on the front wheel of the tilted photo a rim-body reflection was brighter than the lip. Fix: take the outermost highlight ≥15 above the profile median.
   - Camera angle widens the lip: it sits about 14 mm off the center plane, so off-square photos read it about (14 × tan θ) mm too wide each side. Fix: only use lip readings within ±30° of the direction perpendicular to the camera tilt (top and bottom of the wheel for a sideways tilt).
   - With both fixes the lip reads 633 to 636 mm on this rim in both photos (front and rear within about 1 mm). 632 ± 3 is a reasonable 700c default. Tested on one wheelset only (black carbon rims, black tires).
   - The app in this package has it removed. The fixed detector is in `experiments/rim-lip.js`, ready to wire back in as a scale reference (Ø 632 ± 3, both wheels must agree).
2. **Honest ±.** Add the missing error sources to the reruns: BB position about ±3 to 4 mm, BB depth guess, seat tube angle about ±0.5°, soft-point clicks about 2 px. Calibrate against the two-photo scatter above.
3. **Group fit outputs by trust**: "between points" (≈±5) and "from the BB" (≈±10).
4. **Turned front wheel**: when detected, solve the camera from the rear tire plus only the front tire's height, and leave the front tire's width out of the scale. Not built.
5. **Test photos needed**: a phone photo from about 8 ft at eye level (the expected real-world input), a non-drive-side photo (hand placement only, untested), a deliberately turned front wheel at 5° and 10° (to set grade thresholds), and photos of a few other bikes with known geometry (to calibrate ±).
6. **Product notes from the owner**: photo grading goes into the real implementation; the biggest real-world risk is bad photos, not the math; the useful outputs are fit numbers, with frame geometry only for checking scale or reverse-engineering a bike with no chart.

## Known limits

Not modeled: lens distortion (matters for wide phone lenses with the bike filling the frame), tires of different size front and rear, light-colored tires, a saddle the same color as the background. Detectors were tuned on one bike against one plain wall; a dark chainring on a dark background will likely fall back to manual.

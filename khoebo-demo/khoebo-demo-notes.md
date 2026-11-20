# Khoebo Demo — Production Notes

## Deliverables
- `khoebo-promo.mp4` — final 50.0s vertical commercial (1080×1920, 9:16, 30 FPS, H.264/AAC stereo MP4, faststart)
- `khoebo-raw-recording.webm` — original Playwright browser recording (390×844, 104.48s, VP9/WebM)
- `khoebo-storyboard.md` — final vertical storyboard, beat-aligned scene timings, and transition plan
- `khoebo-demo-notes.md` — features demonstrated, tooling, corrections, limitations, and QA
- `music-license.md` — soundtrack provenance, license evidence, Content ID note, and rejection history
- `assets/soundtrack/nastelbom-deep-house-351574.mp3` — licensed music file
- `assets/graphics/` — intro/outro keyframes and transition mask samples exported from the final animation build
- `project/record-demo.cjs` — Playwright warmup/rehearsal/recording script with corrected mobile viewport
- `project/build_promo.py` — FFmpeg/Pillow edit, animation, transition, and render script
- `project/rehearsal/` — rehearsal screenshots used to validate the flow
- `project/render-temp-v2/` — intermediate animation frames, caption frames, masks, lights, clips, and concat list

## Environment & tooling
- **Application:** Khoebo Expo/React Native web UI at `http://localhost:8081` (actual running app).
- **Backend:** local FastAPI at `http://127.0.0.1:8000` with isolated SQLite DB `/tmp/opencode/khoebo-work/demo.db` (`AUTO_CREATE_TABLES=true`) to avoid touching real data.
- **Automation/recording:** Playwright Chromium (headless), `390×844` CSS viewport, `deviceScaleFactor: 2`, `isMobile: true`, `hasTouch: true`, `recordVideo.size` `390×844`, injected visible cursor and subtitle pills, storage state at `/tmp/opencode/khoebo-work/auth-state.json`.
- **Post-production:** Pillow for animated graphics, kinetic typography, masks, and light sweeps; FFmpeg `libx264`/`aac` for composition, transitions, motion blur, and final encoding.
- **FFmpeg workaround:** system `libbluray.so.4` dependency was missing; used `LD_LIBRARY_PATH=/tmp/opencode/khoebo-work/lib` with a `libbluray.so.3` symlink.

## Critical layout correction
- Root cause: the first recording used viewport `540×960` but `recordVideo.size` `1080×1920`; Playwright placed the 540×960 viewport in the top-left of the larger recording canvas, leaving most of the frame grey. The old final then copied that canvas.
- Verification: sampled old frame contained `1,469,348` pixels of exact grey `(128,128,128)`, with app content bounds `x=0–539`, `y=0–959`.
- Fix: viewport and video size now both `390×844`, with true mobile emulation. The app root measured `390×844`, bottom tabs visible, no horizontal scroll.
- Composition: raw `390×844` footage is scaled to `1080×2338` and cropped to `1080×1920` with subtle vertical camera movement, preserving 9:16 aspect without stretching or empty canvas.
- Test recording: `/tmp/opencode/khoebo-work/mobile-test.webm` and composed preview `/tmp/opencode/khoebo-work/mobile-test-composed.mp4`; sampled frames showed full-frame app content and zero grey canvas pixels.

## Demo data (safe, fictional, local only)
- User: `Lerato Molefe` (`demo@khoebo.example` / `Demo2026!`).
- Business: `Maseru Corner Cafe` (LSL).
- Products: Chicken Pie, Malva Pudding, Iced Coffee, Seswaa Plate, Canvas Apron.
- Canvas Apron was low-stock for visibility; pre-seeded sales, expenses, and reminders populated dashboard/bookkeeping/reports realistically.
- Rehearsal and recording created local demo POS sales with receipts; no real or external payment occurred.
- Final figures in the raw/final footage reflect the isolated demo DB state after those local test transactions.

## Features demonstrated (actual, verified)
- Dashboard: monthly metrics, recent sales, quick actions, low-stock alert, reminders.
- POS: add products, review sale, enter customer, choose Card, complete sale, view receipt.
- Stock: product list, stock values, pricing, low-stock visibility.
- Reports: Income report figures.
- Bookkeeping: recorded entries and expenses.
- Analytics: headline values and Top products.
- Tour overlay was skipped and login was warmed before recording so no setup/login footage appears in the final cut.

## Soundtrack & licensing
- Track: `Deep House` by NastelBom.
- Source: https://pixabay.com/music/upbeat-deep-house-351574/
- License: Pixabay Content License; free commercial/promo use and editing, no attribution required. Full terms: https://pixabay.com/service/terms/
- Content ID: page shows `Content ID Registered`; official download record retained in `music-license.md`.
- Local SHA-256: `6d634cffc43443427d749046dc9299c132d6612132fd0e8a0fce864af0d1db11`.
- The previous Afro House track was removed because it did not match the requested contemporary pop/electronic direction.
- Selected track direction verified from official page description and audio analysis: energetic deep house, driving bassline, rhythmic dance beat, bright/uplifting tags, modern lifestyle/fashion use.

## Animation and synchronization
- Scene boundaries are centered on musical onsets/beat-grid points from the `00:22–01:12` excerpt: approximately `5.0s`, `9.5s`, `13.5s`, `17.5s`, `22.4s`, `26.8s`, `31.0s`, `35.4s`, and `45.5s`.
- Transition styles: expanding circle, diagonal mask, staggered panels, directional wipe, diamond reveal, vertical wipe, circle iris, second diagonal reveal, final wipe.
- Each transition uses a 0.6s eased mask, moving light sweep, `tmix` temporal blur, and subtle `boxblur`.
- Kinetic captions use eased slide/fade timing and clear before the next app scene.
- Graphic sequences use staggered text, expanding rings, and light sweeps; the final brand reveal lands after the strong late-track build.

## Limitations & adjustments
- Final is an Expo web recording in a true mobile browser viewport, not a native mobile shell recording; all visible UI is the real app.
- Raw capture includes app loading/blank transitions; final trims those and uses only verified moments.
- No voiceover or sound effects were used; music only.
- App has an Income report view rather than a standalone screen explicitly titled “Income statement.”
- No claims are made about a specific figure auto-updating beyond what is visibly shown.
- No destructive actions, real payments, external notifications, or secrets/tokens are exposed.
- Legacy landscape files remain in the folder and are not the final deliverable.

## QA summary
- Full **Discover → Rehearse → Record** workflow completed before final editing.
- Warmup passed: `PASS Warmup dashboard :: Hi, Lerato`.
- Rehearsal passed all checks: `REHEARSAL PASSED`.
- Mobile inspection confirmed root `390×844`, bottom tabs, no horizontal scroll, and full-width content.
- Short mobile test recording was composed to 1080×1920 and sampled before the full render; no grey canvas remained.
- Final `ffprobe`: `1080×1920`, `30/1` FPS, `1500` frames, H.264 yuv420p video, AAC stereo audio at 48 kHz, duration `50.000000s`, size `16,227,053` bytes.
- Full decode completed with no errors.
- Audio check: `mean_volume -14.9 dB`, `max_volume -3.0 dB`; no silence intervals ≥1s.
- `blackdetect=d=0.2:pix_th=0.10` found no black intervals of 0.2s or longer.
- Sampled frames at 2.0s, 5.2s, 7.0s, 9.5s, 11.0s, 13.5s, 15.0s, 17.5s, 20.0s, 22.4s, 24.0s, 26.8s, 28.5s, 31.0s, 33.0s, 35.4s, 40.0s, 45.5s, 47.0s, and 49.0s confirmed branded intro, app scenes, transitions, and outro are present.
- Sampled frames contained negligible exact-grey pixels (0–24 out of 2,073,600) and no grey empty canvas.

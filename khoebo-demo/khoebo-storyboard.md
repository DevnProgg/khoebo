# Khoebo Product Promo — Storyboard

**Final video:** `khoebo-promo.mp4` (1080×1920, 9:16, 50.0s, 30 FPS, H.264/AAC stereo MP4)  
**Raw capture:** `khoebo-raw-recording.webm` (Playwright Chromium, 390×844 CSS viewport, 104.48s, VP9/WebM)  
**Product:** Khoebo — business operations and management platform  
**Demo environment:** Local authorized test environment (`localhost:8081` Expo web app + local demo backend with isolated temporary SQLite DB and fictional data)

## Creative direction
- Premium vertical SaaS commercial built from real mobile-layout browser interactions only.
- Khoebo brand palette: orange `#E96B1A`, dark ink `#201A16`, warm cream `#F1EDE8`.
- Actual logo from `assets/logo.jpg`; motion uses animated typography, zoom/pan, masked reveals, light sweeps, and controlled motion blur.
- Soundtrack: `Deep House` by NastelBom via Pixabay; excerpt starts at `00:22.000`.
- Narrative: one place for sales, stock, books, and insight.

## Layout correction
- The previous recording used a 540×960 CSS viewport with `recordVideo.size` 1080×1920, which placed a 540×960 app area in the top-left of a 1080×1920 recording canvas and left the rest grey.
- The recording pipeline now uses a genuine mobile portrait viewport (`390×844`, `isMobile: true`, `hasTouch: true`, `deviceScaleFactor: 2`) and `recordVideo.size` also `390×844`.
- The app was inspected at this viewport: bottom tabs visible, no horizontal scroll, root `390×844`, mobile layout active.
- Final footage is full-bleed via scale-and-crop (`390×844` → `1080×1920` with 9:16-preserving crop and subtle vertical camera movement). No stretching or grey canvas.

## Final cut (50.0s)

| Time | Scene | Source | On-screen flow | Message | Transition into scene |
|---|---|---|---|---|---|
| 0:00–0:04.7 | Branded intro | Generated animation | Animated logo, wordmark, staggered pills, light sweep | “Khoebo / Business, simplified.” | — |
| 0:04.7–0:09.5 | Dashboard | Raw 10.2–14.1s | Mobile dashboard with KPI cards, quick actions, low-stock alert | “Everything in one place” / “A live view of your business” | Expanding circle reveal + light sweep at 5.0s beat |
| 0:09.5–0:13.5 | Sell | Raw 20.2–23.6s | Product grid, add items, review pathway | “Sell in seconds” / “Tap. Add. Done.” | Diagonal mask + motion blur at 9.5s beat |
| 0:13.5–0:17.5 | Receipt | Raw 34.0–37.5s | Sale completion, paid receipt, customer and card details | “Sale recorded” / “Payment, tax and totals handled” | Animated panel reveal at 13.5s beat |
| 0:17.5–0:22.4 | Stock | Raw 48.0–52.3s | Stock summary, product list, low-stock item | “Stock stays visible” / “Know what you have” | Directional wipe + light sweep at 17.5s beat |
| 0:22.4–0:26.8 | Reports | Raw 60.0–63.9s | Income report, net income, revenue breakdown | “The books stay balanced” / “Income and expenses in focus” | Diamond geometric reveal on beat grid |
| 0:26.8–0:31.0 | Bookkeeping | Raw 74.0–77.7s | Journal entries, expenses, recorded sale | “Every transaction” / “Neatly recorded” | Vertical panel wipe on beat grid |
| 0:31.0–0:35.4 | Analytics | Raw 86.0–89.9s | Revenue, net profit, average sale, trend | “Know what is working” / “Insights at a glance” | Circle iris reveal on beat grid |
| 0:35.4–0:45.5 | Dashboard return | Raw 10.5–18.0s, slowed | Return to overview with slow camera movement | “Business, simplified” / “One connected workspace” | Diagonal mask + light sweep at strong build |
| 0:45.5–0:50.0 | Branded outro | Generated animation | Expanding ring, logo, headline, feature line, CTA, music credit | “Know your numbers. Grow with confidence.” | Final wipe into brand card at 45.5s beat |

## Transition system
- Nine transitions, each 0.6s, centered on musical onsets/beat-grid points from the selected excerpt.
- Styles used: expanding circle, diagonal mask, staggered panels, directional wipe, diamond reveal, vertical wipe, second circle iris, second diagonal reveal, final wipe.
- All transitions add a moving light sweep and temporal/spatial motion blur (`tmix` + light `boxblur`) for smooth, energetic movement.
- Kinetic typography enters with eased slide/scale/fade and exits before the next app scene, so important application content remains visible.
- Subtle zoom and vertical pan are applied inside each app scene; no stretch and no letterboxing.

## Editing notes
- Raw footage was 104.48s because navigation and waits were left visible; the final cut trims those and keeps only verified app moments.
- App footage is unaltered except for scaling, 9:16-preserving cropping, camera movement, fades, masks, overlays, and typography; no UI, data, or behavior was fabricated.
- Audio excerpt: `00:22.000–01:12.000`, fade-in 0.25s, fade-out 3.0s, volume 0.58.
- Final file is faststart-enabled and encoded H.264 yuv420p video with AAC-LC stereo audio at 48 kHz.

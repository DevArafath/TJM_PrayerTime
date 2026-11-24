# Prayer Times PWA
Offline-capable, installable prayer times app. Host on GitHub Pages (Settings → Pages → deploy from `main` / root).

- `data/prayer-times.json` – yearly timetable (keys `MM-DD`)
- `data/settings.json` – iqamah gaps, Hijri adjustment (`hijriAdjustment`: -2…+2), names, 12/24h
- After editing app files (not the JSON), bump `VERSION` in `sw.js` so phones refresh the cache.

# Twieyes

A one-screen gift page: greeting, a short quote that changes every visit, three moods, and
a looping glyph video with ~10 s song snippets. Plain HTML/CSS/JS, no build step.

## Preview locally
    python3 -m http.server 8080 --bind 127.0.0.1 -d ~/chaithanya
then open http://localhost:8080. Double-clicking index.html also works: `songs.js` and `audio/*.m4a.js` (written by `prepare.py audio` or `prepare.py embed`) let it play songs without a server. Hosted copies don't use the `.m4a.js` files (they are git-ignored).
Add `?debug` to the URL to expose `window.__cg`. Clear site data to reset the quote/song rotation.

## Swap in the real video
    python3 tools/prepare.py video /path/to/video.mp4
Makes assets/loop.mp4 (cross-faded so it loops without a jump, audio removed), poster.jpg and the icons.

## Swap in the real songs
Fill tools/songs.tsv (see the header), then:
    python3 tools/prepare.py audio
Cuts a 10 s snippet per song (normalised loudness) into audio/ and rewrites songs.json.
Then bump VERSION in sw.js so phones that already have the page pick up the new files.

## Edit the quotes / moods
Quotes and mood colours are at the top of app.js. Titles shown under the quote come from songs.json.

## Notes
- Which song plays: the first time a mood is chosen in a visit, that mood moves to its next song.
- Quote and song memory live in the browser (localStorage), so it is per device.
- iPhone: the ringer/silent switch can mute web audio; the page asks Safari to treat it as playback where supported.

## Hosting on GitHub Pages
All paths are relative, so it works from `https://<you>.github.io/<repo>/`.
1. Push this folder to a repo (the files in this folder go at the repo root).
2. Settings → Pages → Deploy from a branch → `main` / root.
3. HTTPS is automatic, which is what the install popup needs.
Free GitHub Pages needs a public repo, so the song snippets would be publicly downloadable.
After changing the video or songs, bump `VERSION` in sw.js so phones refresh their cache.

## Install popup
Shown shortly after the page opens, on every open and reload (it does not remember "Not now"), unless the page is already installed. Android/desktop Chrome get the real
install prompt; iPhone gets "Share → Add to Home Screen" steps; 
Preview the variants with `?debug&install=prompt`, `?debug&install=ios` or `?debug&install=menu`.

## Greeting and quotes
The greeting follows her clock (Good morning / afternoon / evening, and "Hey, night owl" from midnight to 5 am) and is a plain "Hi" every third visit.
The quote changes by itself every 15 s. Preview a greeting with `?debug&greet=Good%20morning`.

## App name and icon
The app is called **Twieyes** (title, manifest, home-screen label, install popup). To rename it, change `name`/`short_name` in manifest.webmanifest,
the `<title>` and `apple-mobile-web-app-title` in index.html, and the name in the install sheet.
The icon source is `tools/icon.html` (a sun setting inside an eye-shaped lens: twilight + eyes); `tools/icon-master.png` is its 1024 px render, from which
assets/icon-192/512/maskable, apple-touch-icon, favicon-32/48 and favicon.ico are scaled. Re-render with headless Chrome at
`http://localhost:8080/tools/icon.html` (add `?tab=1` for the bolder tab-size version). Bump `VERSION` in sw.js after changing icons.

## Performance and shutdown notes
Song clips for each mood's next song are decoded in the background while the greeting plays, so tapping a mood only starts playback.
When the page is closed, reloaded or frozen (`pagehide`/`freeze`) the audio engine is closed, the video paused and the glow stopped.
While the eye opens, the wandering light and the portrait drift hold still, and the film grain fades out, so the video starts without competing work.

## While the video plays
Only two small controls remain, in the corners so the video has the whole screen: a back arrow (top-left, fades the sound and reloads to the greeting, so a new quote and song) and, bottom-right, a next-song button (plays the next song in this mood's order; the next visit carries on after it) beside the sound on/off icon.
To change mood, go back and pick again.

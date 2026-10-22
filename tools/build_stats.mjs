// Builds stats.html: a lock screen holding the encrypted dashboard (tools/stats-private.html, which is never published).
// Usage:  node tools/build_stats.mjs "<password>"        (or set STATS_PASSWORD)
// The password is never stored anywhere; it is only used to derive the key (PBKDF2-SHA256, 600k rounds -> AES-256-GCM).
import { readFileSync, writeFileSync } from 'node:fs';
import { pbkdf2Sync, randomBytes, createCipheriv } from 'node:crypto';

const password = process.argv[2] || process.env.STATS_PASSWORD;
if (!password) { console.error('usage: node tools/build_stats.mjs "<password>"'); process.exit(1); }
if (password.length < 10) { console.error('please use at least 10 characters: the encrypted page is public'); process.exit(1); }

const ITER = 600000;
const plain = readFileSync(new URL('./stats-private.html', import.meta.url));
const salt = randomBytes(16), iv = randomBytes(12);
const key = pbkdf2Sync(password, salt, ITER, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const data = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);      // WebCrypto wants ciphertext + tag together

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0b0708">
<title>Twieyes</title>
<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">
<style>
  @font-face { font-family: "Instrument Serif"; src: url("fonts/instrument-serif-latin-400-normal.woff2") format("woff2"); font-display: swap; }
  @font-face { font-family: "Instrument Serif"; src: url("fonts/instrument-serif-latin-400-italic.woff2") format("woff2"); font-style: italic; font-display: swap; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: #0b0708; color: #f8ede8; font: 20px/1.3 "Instrument Serif", Georgia, serif; -webkit-font-smoothing: antialiased; }
  main { min-height: 100%; display: grid; place-content: center; gap: 18px; padding: 24px; width: min(100%, 420px); margin: 0 auto; }
  p { color: #f2c6bd; font-style: italic; opacity: .85; }
  form { display: grid; gap: 12px; }
  input { font: inherit; color: inherit; background: #1b1213; border: 1px solid #2b1c1d; border-radius: 14px; padding: 14px 16px; width: 100%; outline: none; }
  input:focus-visible { border-color: #e8776a; }
  button { font: inherit; color: #0b0708; background: #e8776a; border: 0; border-radius: 999px; padding: 13px 20px; cursor: pointer; transition: transform 160ms cubic-bezier(.23,1,.32,1); }
  button:active { transform: scale(.97); }
  button:disabled { opacity: .6; cursor: default; }
  #err { min-height: 1.3em; color: #e8776a; font-style: normal; opacity: 1; }
</style>
</head>
<body>
<main>
  <p>this one is private</p>
  <form id="f" autocomplete="off">
    <input id="pw" type="password" placeholder="password" aria-label="password" autocomplete="current-password" autofocus>
    <button id="go" type="submit">open</button>
    <p id="err" role="alert"></p>
  </form>
</main>
<script>
(() => {
  const SALT = "${salt.toString('base64')}", IV = "${iv.toString('base64')}", ITER = ${ITER};
  const DATA = "${data.toString('base64')}";
  const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function unlock(pw) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(SALT), iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(IV) }, key, bytes(DATA)));
  }
  const f = document.getElementById('f'), err = document.getElementById('err'), go = document.getElementById('go');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('pw').value;
    if (!pw) return;
    go.disabled = true; err.textContent = '';
    try {
      const html = await unlock(pw);
      document.open(); document.write(html); document.close();
    } catch {
      await new Promise((r) => setTimeout(r, 700));                      // a wrong guess takes a moment
      err.textContent = 'not that one'; go.disabled = false; document.getElementById('pw').select();
    }
  });
})();
</script>
</body>
</html>
`;
writeFileSync(new URL('../stats.html', import.meta.url), page);
console.log('stats.html written (' + Math.round(page.length / 1024) + ' KB, encrypted)');

#!/usr/bin/env python3
"""Prepare the page's media.

  prepare.py video <input-video>        -> assets/loop.mp4 (seamless loop, no audio) + assets/poster.jpg + poster-soft.jpg
  prepare.py audio [tools/songs.tsv]    -> audio/<mood>-<n>.m4a (10 s snippets) + songs.json
  prepare.py placeholders               -> synthetic stand-in clips + songs.json (for testing only)
  prepare.py embed                      -> songs.js + audio/*.m4a.js so the page also plays when opened as a plain file

songs.tsv, one song per line, tab separated, in play order within each mood:
  mood <TAB> file <TAB> start (m:ss, optional) <TAB> title <TAB> artist
Leave start empty to auto-pick the loudest 10 s from the middle of a full song; a clip of 18 s or less is used whole.
"""
import array, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIP = 10.0          # snippet length in seconds when a song has to be cut
PRETRIMMED_MAX = 18.0  # a source this short is taken whole, as the person already chose that part
MOODS = ['soft', 'playful', 'energetic']


def run(*cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def probe_duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def video(src):
    d = probe_duration(src)
    x = min(0.6, d / 4)                                   # cross-fade length
    out = os.path.join(ROOT, 'assets', 'loop.mp4')
    # main = everything after the first x seconds; head = the first x seconds.
    # Cross-fading the end of main into head makes the last frame equal the frame the loop restarts on.
    graph = (f"[0:v]fps=30,split[a][b];[a]trim=start={x},setpts=PTS-STARTPTS,fps=30[main];"
             f"[b]trim=end={x},setpts=PTS-STARTPTS,fps=30[head];"
             f"[main][head]xfade=transition=fade:duration={x}:offset={d - 2 * x},"
             f"scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[v]")
    run('ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-filter_complex', graph, '-map', '[v]', '-an',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-movflags', '+faststart', out)
    poster = os.path.join(ROOT, 'assets', 'poster.jpg')
    run('ffmpeg', '-loglevel', 'error', '-y', '-ss', '0.8', '-i', out, '-frames:v', '1', '-q:v', '3', poster)
    # a tiny pre-blurred poster for the home screen, and a padded icon for Android's adaptive (maskable) icons
    run('ffmpeg', '-loglevel', 'error', '-y', '-i', poster, '-vf', 'scale=357:-2,gblur=sigma=5,eq=saturation=1.05',
        '-q:v', '4', os.path.join(ROOT, 'assets', 'poster-soft.jpg'))
    # landscape (rotated upright) version for the home screen on PCs: lightly blurred so the glyph rows melt away but the eyes stay readable
    run('ffmpeg', '-loglevel', 'error', '-y', '-ss', '1.5', '-i', out, '-frames:v', '1', '-vf', 'transpose=2,scale=1280:-2,gblur=sigma=9:sigmaV=4,eq=saturation=1.05',
        '-q:v', '4', os.path.join(ROOT, 'assets', 'poster-wide.jpg'))
    print(f'loop.mp4: {os.path.getsize(out) / 1e6:.2f} MB, {d - x:.2f} s loop (cross-fade {x:.2f} s)')


def parse_time(s):
    parts = [float(p) for p in s.strip().split(':')]
    t = 0.0
    for p in parts:
        t = t * 60 + p
    return t


def auto_start(path, total):
    """Loudest CLIP-second window within the middle 20-80% of the song (decoded to 8 kHz mono)."""
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    pcm = array.array('h')
    pcm.frombytes(raw[:len(raw) // 2 * 2])
    sec = [sum(v * v for v in pcm[i:i + 8000]) / 8000 for i in range(0, len(pcm) - 7999, 8000)]
    win = int(CLIP)
    lo, hi = int(total * 0.2), max(int(total * 0.8) - win, int(total * 0.2) + 1)
    best, best_i = -1, lo
    for i in range(lo, min(hi, len(sec) - win)):
        e = sum(sec[i:i + win])
        if e > best:
            best, best_i = e, i
    return float(best_i)


def audio(manifest):
    os.makedirs(os.path.join(ROOT, 'audio'), exist_ok=True)
    songs = {m: [] for m in MOODS}
    counts = {m: 0 for m in MOODS}
    for line in open(manifest, encoding='utf-8'):
        if not line.strip() or line.startswith('#'):
            continue
        cols = (line.rstrip('\n').split('\t') + [''] * 5)[:5]
        mood, file, start, title, artist = [c.strip() for c in cols]
        if mood not in songs:
            sys.exit(f'unknown mood "{mood}" (use {", ".join(MOODS)})')
        counts[mood] += 1
        n = counts[mood]
        total = probe_duration(file)
        whole = not start and total <= PRETRIMMED_MAX            # already cut down by hand: keep it exactly as chosen
        t0 = 0.0 if whole else (parse_time(start) if start else auto_start(file, total))
        length = total if whole else CLIP
        t0 = max(0.0, min(t0, total - length))
        name = f'{mood}-{n}.m4a'
        # loudness-normalise so no song is suddenly louder than another
        run('ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{t0:.2f}', '-t', f'{length:.2f}', '-i', file, '-vn',
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '128k',
            os.path.join(ROOT, 'audio', name))
        songs[mood].append({'file': f'audio/{name}', 'title': title, 'artist': artist, 'start': round(t0, 1)})
        print(f'{mood}-{n}: {title or file}  {length:.1f}s ' + ('(whole clip)' if whole else f'from {int(t0 // 60)}:{int(t0 % 60):02d}' + ('' if start else ' (auto)')))
    write_songs(songs)


def placeholders():
    """Soft synthetic chords so the player can be tested before the real songs arrive."""
    os.makedirs(os.path.join(ROOT, 'audio'), exist_ok=True)
    chords = {'soft': [(220, 277, 330), (196, 247, 294), (233, 294, 349)],
              'playful': [(262, 330, 392), (294, 370, 440), (247, 311, 370)],
              'energetic': [(330, 415, 494), (349, 440, 523), (392, 494, 587)]}
    songs = {m: [] for m in MOODS}
    for mood, group in chords.items():
        for n, notes in enumerate(group, 1):
            name = f'{mood}-{n}.m4a'
            inputs = []
            for f in notes:
                inputs += ['-f', 'lavfi', '-i', f'sine=frequency={f}:duration={CLIP}']
            run('ffmpeg', '-loglevel', 'error', '-y', *inputs, '-filter_complex',
                f'amix=inputs=3,volume=2.2,tremolo=f={2 + n}:d=0.25', '-c:a', 'aac', '-b:a', '96k',
                os.path.join(ROOT, 'audio', name))
            songs[mood].append({'file': f'audio/{name}', 'title': f'Placeholder {mood} {n}', 'artist': '', 'start': 0})
    write_songs(songs)
    print('placeholder clips written. Replace them with prepare.py audio.')


def write_songs(songs):
    with open(os.path.join(ROOT, 'songs.json'), 'w', encoding='utf-8') as f:
        json.dump(songs, f, indent=2, ensure_ascii=False)
        f.write('\n')
    embed()


def embed():
    """songs.js (the song list) and audio/<clip>.m4a.js (each clip as a data: URI). Browsers block fetch() on file:// pages, so these
    let the page play when it is double-clicked from a folder. A hosted copy uses the plain .m4a files and never loads the .js ones."""
    import base64
    songs = json.load(open(os.path.join(ROOT, 'songs.json'), encoding='utf-8'))
    with open(os.path.join(ROOT, 'songs.js'), 'w', encoding='utf-8') as f:
        f.write('window.__songs = ' + json.dumps(songs, ensure_ascii=False) + ';\n')
    for mood in songs.values():
        for s in mood:
            path = os.path.join(ROOT, s['file'])
            data = base64.b64encode(open(path, 'rb').read()).decode()
            with open(path + '.js', 'w') as f:
                f.write('(window.__clips = window.__clips || {})[' + json.dumps(s['file']) + '] = "data:audio/mp4;base64,' + data + '";\n')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'video' and len(sys.argv) > 2:
        video(sys.argv[2])
    elif cmd == 'audio':
        audio(sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'tools', 'songs.tsv'))
    elif cmd == 'embed':
        embed()
    elif cmd == 'placeholders':
        placeholders()
    else:
        print(__doc__)

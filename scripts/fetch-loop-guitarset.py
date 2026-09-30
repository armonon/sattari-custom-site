"""Fetch six predetermined GuitarSet recordings and labels using ZIP byte ranges.

Data stays under ignored .local-data; no copyrighted song is bundled with Loop.
Dataset: Xi et al., GuitarSet v1.1.0, https://doi.org/10.5281/zenodo.3371780.
This is a real-recording regression sample, NOT an independently verified
held-out set: GuitarSet is among Basic Pitch's training corpora.
Selection is fixed before running inference: one track per player, alternating
comp/solo, alphabetically first matching track. Never tune against these labels.
"""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import urllib.request
import zlib

OUT = Path('.local-data/loop-polyphonic/guitarset')
OUT.mkdir(parents=True, exist_ok=True)

def read_range(url, start, end):
    req = urllib.request.Request(url, headers={'Range': f'bytes={start}-{end}'})
    with urllib.request.urlopen(req, timeout=60) as response:
        if response.status != 206:
            raise RuntimeError('Server did not honor byte range; refusing full archive download.')
        data = response.read(end - start + 2)
        if len(data) != end - start + 1:
            raise RuntimeError('Incomplete ZIP range')
        return data

def zip_index(url, size):
    tail = read_range(url, size - 65536, size - 1)
    end = struct.unpack_from('<4s4H2LH', tail, tail.rfind(b'PK\x05\x06'))
    directory = read_range(url, end[6], end[6] + end[5] - 1)
    files, at = {}, 0
    while directory[at:at+4] == b'PK\x01\x02':
        fields = struct.unpack_from('<4s6H3L5H2L', directory, at)
        name = directory[at+46:at+46+fields[10]].decode()
        files[name] = {'length': fields[8], 'offset': fields[-1], 'crc': fields[7]}
        at += 46 + fields[10] + fields[11] + fields[12]
    return files

def extract(url, entry, path):
    header = read_range(url, entry['offset'], entry['offset'] + 29)
    fields = struct.unpack('<4s5H3L2H', header)
    start = entry['offset'] + 30 + fields[-2] + fields[-1]
    packed = read_range(url, start, start + entry['length'] - 1)
    data = zlib.decompress(packed, -15) if fields[3] == 8 else packed
    if zlib.crc32(data) != entry['crc']:
        raise RuntimeError('ZIP CRC mismatch')
    path.write_bytes(data)
    return hashlib.sha256(data).hexdigest()

audio_url = 'https://zenodo.org/records/3371780/files/audio_mono-mic.zip'
label_url = 'https://zenodo.org/records/3371780/files/annotation.zip'
audio_index = zip_index(audio_url, 656927981)
label_index = zip_index(label_url, 39132574)
manifest = {'source': 'https://doi.org/10.5281/zenodo.3371780',
    'scope': 'Real-recording regression sample. Training overlap unknown; not held-out accuracy.', 'tracks': []}
for player in range(6):
    mode = 'comp' if player % 2 == 0 else 'solo'
    name = sorted(n for n in audio_index if n.startswith(f'{player:02d}_') and n.endswith(f'_{mode}_mic.wav'))[0]
    track = name.removesuffix('_mic.wav')
    label = next(n for n in label_index if n.endswith(track + '.jams') and not n.startswith('__MACOSX'))
    wav = OUT / name
    jams = OUT / (track + '.jams')
    audio_sha = extract(audio_url, audio_index[name], wav)
    label_sha = extract(label_url, label_index[label], jams)
    # macOS's audio converter uses a band-limited sample-rate conversion, like the browser.
    converted = OUT / (track + '-22050.wav')
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEF32@22050', str(wav), str(converted)], check=True)
    manifest['tracks'].append({'id': track, 'audio': str(converted), 'labels': str(jams),
        'audioSha256': audio_sha, 'labelSha256': label_sha, 'start': 0, 'seconds': 12})
    print(track, flush=True)
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

"""
CLAP embeddings for all ~18,500 SONYC clips.

Processes archives one at a time without full extraction — extracts WAVs to
a temp dir, embeds in batches, deletes temp, moves to next archive. Saves a
checkpoint after each archive so the run is resumable if interrupted.

Output:
  analysis/embeddings.npy        — float32 array, shape (N, 512)
  analysis/embeddings_meta.jsonl — one JSON line per clip

Usage:
  source analysis/.venv/bin/activate
  python analysis/embed_all.py

Estimated time: 60–90 min CPU, 15–25 min Apple MPS
"""

import csv
import json
import os
import tarfile
import tempfile
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import soundfile as sf
import torch
from transformers import ClapModel, ClapProcessor

AUDIO_DIR = 'audio'
ANNOTATIONS_CSV = 'public/data/metadata/annotations.csv'
OUTPUT_NPY = 'analysis/embeddings.npy'
OUTPUT_META = 'analysis/embeddings_meta.jsonl'
CHECKPOINT_DIR = 'analysis/checkpoints'
BATCH_SIZE = 16
MODEL_ID = 'laion/larger_clap_music_and_speech'
TARGET_SR = 48000  # CLAP expects 48kHz


def get_device():
    if torch.backends.mps.is_available():
        print('using Apple MPS (GPU)')
        return torch.device('mps')
    if torch.cuda.is_available():
        print('using CUDA')
        return torch.device('cuda')
    print('using CPU')
    return torch.device('cpu')


def load_annotations():
    """build {filename -> {borough, hour, classes[]}} from annotations.csv"""
    print(f'loading annotations from {ANNOTATIONS_CSV}...')
    meta = {}

    # fine class columns we care about
    fine_cols = [
        '1-1_small-sounding-engine_presence',
        '1-2_medium-sounding-engine_presence',
        '1-3_large-sounding-engine_presence',
        '2-1_rock-drill_presence',
        '2-2_jackhammer_presence',
        '2-3_hoe-ram_presence',
        '2-4_pile-driver_presence',
        '3-1_non-machinery-impact_presence',
        '4-1_chainsaw_presence',
        '4-2_small-medium-rotating-saw_presence',
        '4-3_large-rotating-saw_presence',
        '5-1_car-horn_presence',
        '5-2_car-alarm_presence',
        '5-3_siren_presence',
        '5-4_reverse-beeper_presence',
        '6-1_stationary-music_presence',
        '6-2_mobile-music_presence',
        '6-3_ice-cream-truck_presence',
        '7-1_person-or-small-group-talking_presence',
        '7-2_person-or-small-group-shouting_presence',
        '7-3_large-crowd_presence',
        '7-4_amplified-speech_presence',
        '8-1_dog-barking-whining_presence',
    ]

    label_map = {c: c.split('_presence')[0].split('_', 1)[-1] for c in fine_cols}

    with open(ANNOTATIONS_CSV, newline='') as f:
        for row in csv.DictReader(f):
            fname = row['audio_filename']
            is_gt = row['annotator_id'] == '0'
            if fname not in meta:
                meta[fname] = {
                    'borough': row.get('borough', ''),
                    'hour': int(row.get('hour', -1)),
                    'classes': [],
                    'gt': False,
                }
            if is_gt:
                meta[fname]['gt'] = True
                for col in fine_cols:
                    if row.get(col) == '1':
                        label = label_map[col]
                        if label not in meta[fname]['classes']:
                            meta[fname]['classes'].append(label)

    print(f'  {len(meta)} unique clips in annotations')
    return meta


def load_model():
    print(f'loading CLAP model: {MODEL_ID}')
    print('  (first run downloads ~900MB — subsequent runs use cache)')
    processor = ClapProcessor.from_pretrained(MODEL_ID)
    model = ClapModel.from_pretrained(MODEL_ID)
    device = get_device()
    model = model.to(device)
    model.eval()
    return model, processor, device


def embed_batch(wavs, model, processor, device):
    """embed a list of (audio_array, sr) tuples, return (N, 512) numpy array"""
    # resample to TARGET_SR if needed and flatten to mono
    import librosa as _librosa
    arrays = []
    for y, sr in wavs:
        if y.ndim > 1:
            y = y.mean(axis=1)
        if sr != TARGET_SR:
            y = _librosa.resample(y, orig_sr=sr, target_sr=TARGET_SR)
        arrays.append(y.astype(np.float32))

    inputs = processor(
        audio=arrays,
        sampling_rate=TARGET_SR,
        return_tensors='pt',
        padding=True,
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        embs = model.get_audio_features(**inputs)

    # normalize to unit sphere (standard for cosine similarity)
    embs = embs / embs.norm(dim=-1, keepdim=True)
    return embs.cpu().float().numpy()


def already_done():
    """return set of archive numbers already processed"""
    done = set()
    if os.path.isdir(CHECKPOINT_DIR):
        for f in os.listdir(CHECKPOINT_DIR):
            if f.startswith('archive_') and f.endswith('.npy'):
                try:
                    n = int(f.replace('archive_', '').replace('.npy', ''))
                    done.add(n)
                except ValueError:
                    pass
    return done


def process_archive(archive_num, model, processor, device, annotations):
    """extract + embed one archive, return (embeddings, meta_list)"""
    archive_path = os.path.join(AUDIO_DIR, f'audio-{archive_num}.tar.gz')
    checkpoint_npy = os.path.join(CHECKPOINT_DIR, f'archive_{archive_num}.npy')
    checkpoint_meta = os.path.join(CHECKPOINT_DIR, f'archive_{archive_num}_meta.jsonl')

    print(f'\n── archive {archive_num} ──')
    all_embs = []
    all_meta = []

    with tempfile.TemporaryDirectory() as tmpdir:
        # extract all WAVs
        print(f'  extracting {archive_path}...')
        with tarfile.open(archive_path, 'r:gz') as tf:
            wav_members = [m for m in tf.getmembers() if m.name.endswith('.wav')]
            tf.extractall(tmpdir, members=wav_members)

        wav_files = []
        for root, _, files in os.walk(tmpdir):
            for f in files:
                if f.endswith('.wav'):
                    wav_files.append(os.path.join(root, f))

        print(f'  {len(wav_files)} WAV files, embedding in batches of {BATCH_SIZE}...')

        batch_wavs = []
        batch_meta = []

        def flush_batch():
            if not batch_wavs:
                return
            try:
                embs = embed_batch(batch_wavs, model, processor, device)
                all_embs.append(embs)
                all_meta.extend(batch_meta)
            except Exception as e:
                print(f'    batch error: {e}')
            batch_wavs.clear()
            batch_meta.clear()

        for i, wav_path in enumerate(sorted(wav_files)):
            fname = os.path.basename(wav_path)
            try:
                y, sr = sf.read(wav_path, always_2d=False)
                batch_wavs.append((y, sr))
                ann = annotations.get(fname, {})
                batch_meta.append({
                    'filename': fname,
                    'archive': archive_num,
                    'borough': ann.get('borough', ''),
                    'hour': ann.get('hour', -1),
                    'classes': ann.get('classes', []),
                    'gt': ann.get('gt', False),
                })
            except Exception as e:
                print(f'    read error {fname}: {e}')
                continue

            if len(batch_wavs) >= BATCH_SIZE:
                flush_batch()
                if (i + 1) % 100 == 0:
                    print(f'    {i + 1}/{len(wav_files)} done')

        flush_batch()

    if all_embs:
        embs_arr = np.vstack(all_embs)
        np.save(checkpoint_npy, embs_arr)
        with open(checkpoint_meta, 'w') as f:
            for m in all_meta:
                f.write(json.dumps(m) + '\n')
        print(f'  checkpoint saved: {embs_arr.shape[0]} clips embedded')
        return embs_arr, all_meta
    return None, []


def merge_checkpoints():
    """combine all per-archive checkpoints into final output files"""
    print('\nmerging checkpoints...')
    archives = sorted(
        int(f.replace('archive_', '').replace('.npy', ''))
        for f in os.listdir(CHECKPOINT_DIR)
        if f.startswith('archive_') and f.endswith('.npy') and '_meta' not in f
    )

    all_embs = []
    with open(OUTPUT_META, 'w') as out_meta:
        for n in archives:
            npy = os.path.join(CHECKPOINT_DIR, f'archive_{n}.npy')
            meta = os.path.join(CHECKPOINT_DIR, f'archive_{n}_meta.jsonl')
            all_embs.append(np.load(npy))
            if os.path.exists(meta):
                with open(meta) as f:
                    out_meta.write(f.read())

    final = np.vstack(all_embs)
    np.save(OUTPUT_NPY, final)
    print(f'final embeddings: {final.shape}  →  {OUTPUT_NPY}')
    print(f'metadata         →  {OUTPUT_META}')
    return final


def main():
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    os.makedirs('analysis', exist_ok=True)

    annotations = load_annotations()
    model, processor, device = load_model()

    archives = sorted(
        int(f.replace('audio-', '').replace('.tar.gz', ''))
        for f in os.listdir(AUDIO_DIR)
        if f.startswith('audio-') and f.endswith('.tar.gz')
    )
    print(f'\nfound {len(archives)} archives: {archives}')

    done = already_done()
    if done:
        print(f'already processed: {sorted(done)} — skipping')

    for n in archives:
        if n in done:
            continue
        process_archive(n, model, processor, device, annotations)

    merge_checkpoints()
    print('\ndone.')


if __name__ == '__main__':
    main()

import { useEffect, useRef, useState } from 'react';
import { importMidi } from '../../utils/arrangementMidi';
import { analyzeAudioFile, createWaveformPeaks } from '../../utils/audioAnalysis';
import { getAudioAsset, putAudioAsset } from '../../utils/audioProjectStore';
import { audioClip, audioTrack, updatePatternClip } from '../../utils/arrangementModel';
import { isLibraryAudio } from '../../utils/musicLibrary';
import { PerformancePlayer } from '../../utils/performancePlayer';
import { downloadExport } from './ExportRangePanel';
import {
  addReferenceTake,
  appendClip,
  appendTracks,
  printedPerformanceTracks,
  relinkAsset,
} from './projectEdits';
import { useStableActions } from './useStableCallback';

/**
 * Long-running editor operations. Each is exclusive: it pauses playback, marks
 * the editor busy and releases that state however it ends.
 */
export function useArrangementOperations({
  history,
  playback,
  flags,
  ready,
  busy,
  bpm,
  getEngine,
  onBusy,
  setBusy,
  setMessage,
  edit,
  exportSettings,
}) {
  const { working, cancelled, mounted } = flags;
  const { pause, position, engine, getArrangementEngine, setPlaying, settings } = playback;
  const player = useRef(null);
  const [activeReplay, setActiveReplay] = useState(null);
  useEffect(() => () => player.current?.dispose(), []);
  const start = (resetCancel = true) => {
    pause();
    working.current = true;
    onBusy(true);
    setBusy(true);
    if (resetCancel) cancelled.current = false;
  };
  const finish = () => {
    working.current = false;
    onBusy(false);
    if (mounted.current) setBusy(false);
  };
  const actions = useStableActions({
    async addFiles(entries, trackId = null, at = position.current) {
      if (working.current || !ready) return;
      start();
      const before = history.project;
      let next = before,
        count = 0,
        failed = 0;
      try {
        for (const { file } of await entries) {
          if (cancelled.current) break;
          if (/\.(mid|midi)$/i.test(file.name)) {
            try {
              const imported = importMidi(await file.arrayBuffer(), {
                bpm,
                start: at,
                name: file.name.replace(/\.[^.]+$/, ''),
              });
              next = appendTracks(next, imported.tracks);
              count += imported.tracks.length;
            } catch (error) {
              failed++;
              setMessage(error.message);
            }
            continue;
          }
          if (!isLibraryAudio(file)) continue;
          setMessage(`Importing ${file.name}…`);
          try {
            const analysis = await analyzeAudioFile(file),
              asset = await putAudioAsset(file, { name: file.name, analysis });
            if (
              !Number.isFinite(analysis.duration) ||
              analysis.duration < 0.001 ||
              analysis.duration > 86400
            )
              throw new Error('Unsupported audio duration.');
            // Without an existing target track, every file gets a lane of its own.
            const lane = next.tracks.some((item) => item.id === trackId)
              ? null
              : audioTrack(file.name.replace(/\.[^.]+$/, ''));
            const clip = {
              ...audioClip(asset.id, file.name, analysis.duration, at),
              waveform: analysis.waveform,
            };
            next = lane
              ? appendTracks(next, [{ ...lane, clips: [clip] }])
              : appendClip(next, trackId, clip);
            count++;
            if (trackId) at += analysis.duration;
          } catch {
            failed++;
          }
        }
        if (mounted.current && count) {
          // A live take can finish while files decode. Preserve that newly added
          // track and its event log rather than replacing it with the import snapshot.
          const latest = history.project,
            originalIds = new Set(before.tracks.map((track) => track.id));
          history.commit(
            {
              ...next,
              captures: latest.captures,
              tracks: [
                ...next.tracks,
                ...latest.tracks.filter((track) => !originalIds.has(track.id)),
              ],
            },
            { validate: false, sync: false }
          );
        }
        if (mounted.current)
          setMessage(
            `${count} clips imported · ${failed} failed. MIDI follows project tempo with built-in voices; tempo maps, programs and unsupported controllers are not imported.`
          );
      } catch (error) {
        if (mounted.current) setMessage(error.message);
      } finally {
        finish();
      }
    },
    async addTake(recording) {
      if (working.current || !ready) return;
      start();
      try {
        const asset = await getAudioAsset(recording.id);
        if (!asset?.blob)
          throw new Error('Recorded audio is missing. Restore its portable project backup.');
        const decoded = await getEngine()
          .getAudioContext()
          .rawContext.decodeAudioData(await asset.blob.arrayBuffer());
        if (cancelled.current || !mounted.current) return;
        const track = audioTrack(recording.name);
        track.role = 'reference';
        track.clips.push({
          ...audioClip(recording.id, recording.name, decoded.duration, position.current),
          waveform: createWaveformPeaks(decoded.getChannelData(0), 2048),
        });
        working.current = false;
        edit((project) => addReferenceTake(project, track));
        setMessage(
          'Recorded take added as an editable audio lane. Its original audio is unchanged.'
        );
      } catch (error) {
        if (mounted.current) setMessage(error.message);
      } finally {
        finish();
      }
    },
    async exportAudio(stems) {
      if (working.current) return;
      start();
      try {
        const blob = await getArrangementEngine().export(
          history.project,
          settings.current,
          stems,
          setMessage,
          () => cancelled.current,
          exportSettings.rangeEnabled
            ? { start: exportSettings.rangeStart, end: exportSettings.rangeEnd }
            : null
        );
        if (!mounted.current) return;
        const name = exportSettings.name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'stemdeck';
        const filename = stems ? `${name}-track-stems.zip` : `${name}-mixdown.wav`;
        exportSettings.setFiles((files) => [...files, { file: blob, name: filename }]);
        downloadExport(blob, filename);
        setMessage(
          stems
            ? 'Stem ZIP download requested · 48 kHz / 24-bit · aligned pre-master track stems.'
            : 'Mixdown download requested · 48 kHz / 24-bit WAV · includes master processing.'
        );
      } catch (error) {
        if (mounted.current) setMessage(error.message);
      } finally {
        finish();
      }
    },
    async relinkFile(file, assetId) {
      if (!file || busy || !ready) return;
      start(false);
      try {
        const analysis = await analyzeAudioFile(file);
        const needed = Math.max(
          0,
          ...history.project.tracks.flatMap((track) =>
            track.clips
              .filter((clip) => clip.assetId === assetId)
              .map((clip) => clip.offset + clip.duration * clip.rate)
          )
        );
        if (analysis.duration + 0.001 < needed)
          throw new Error(
            `Replacement must contain at least ${needed.toFixed(2)} seconds of audio.`
          );
        const asset = await putAudioAsset(file, { name: file.name, analysis });
        if (!mounted.current) return;
        working.current = false;
        edit((project) =>
          relinkAsset(project, assetId, {
            assetId: asset.id,
            sourceDuration: analysis.duration,
            waveform: analysis.waveform,
          })
        );
        setMessage(
          'Source relinked for every matching clip. Re-enable offline tracks when all their sources are restored.'
        );
      } catch (error) {
        if (mounted.current) setMessage(error.message);
      } finally {
        finish();
      }
    },
    async loadSample(file, clipId) {
      if (!file || working.current) return;
      if (file.size > 32 * 1024 * 1024) {
        setMessage('Use an instrument sample smaller than 32 MB.');
        return;
      }
      start(false);
      try {
        const decoded = await getEngine()
          .getAudioContext()
          .rawContext.decodeAudioData(await file.arrayBuffer());
        if (decoded.duration > 60)
          throw new Error(
            'Choose a sample under 60 seconds. Import longer recordings as audio tracks.'
          );
        const asset = await putAudioAsset(file, { name: file.name });
        getArrangementEngine().buffers.set(asset.id, decoded);
        working.current = false;
        if (mounted.current) {
          edit((project) =>
            updatePatternClip(project, clipId, {
              instrument: 'sampler',
              assetId: asset.id,
              sampleRoot: 'C4',
            })
          );
          setMessage(`Sample loaded: ${file.name}. Set its original pitch with Sample root.`);
        }
      } catch (error) {
        if (mounted.current) setMessage(error.message);
      } finally {
        finish();
      }
    },
    async replay(capture, record = false, options = {}) {
      if (busy) return;
      engine.current?.pause();
      setPlaying(false);
      setBusy(true);
      player.current?.dispose();
      const current = new PerformancePlayer(getEngine(), {
        onStatus: setMessage,
        onFinish: ({ sources, error, lateEvents, maxLateness, offset }) => {
          if (!error && sources?.tracks?.length)
            edit((project) =>
              appendTracks(project, printedPerformanceTracks(sources, capture, offset))
            );
          setMessage(
            error?.message ||
              `${sources ? 'Edited performance printed, muted for comparison. ' : 'Replay finished. '}Late control events (>25 ms): ${lateEvents || 0}; worst ${(1000 * (maxLateness || 0)).toFixed(1)} ms. ${sources?.error || ''}`
          );
          setBusy(false);
          setActiveReplay(null);
          current.dispose();
        },
      });
      player.current = current;
      try {
        await current.prepare(capture, history.project.tracks, options);
        setActiveReplay(capture.id || capture.assetId);
        await current.play({ record });
      } catch (error) {
        current.dispose();
        setBusy(false);
        setActiveReplay(null);
        setMessage(error.message);
      }
    },
    stopReplay() {
      void player.current?.stop();
    },
  });
  return { ...actions, activeReplay };
}

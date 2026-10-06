import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Captions,
  Download,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Pause,
  Play,
  Square,
  Type,
  Wand2,
} from 'lucide-react';
import AudioLabShell from '../audio/AudioLabShell';
import { formatTime, LabDrop } from '../audio/AudioLabParts';
import { baseName, decodeMono, downloadBlob, peaksOf } from '../audio/audioLabFiles';
import { decodeTrack as decodeStemTrack } from '../../utils/stemSeparator';
import { StemSeparatorClient } from '../../utils/stemSeparatorClient';
import { decodeAudioBuffer } from './lyricAudio';
import { LyricWhisperClient } from './lyricWhisperClient';
import { normalizeAsrWords } from './normalizeWords';
import { alignLyricsToAsr, buildLyricLines, nudgeWord, tokenizeLyrics } from './lyricAlign';
import { drawCaption, findActiveLine, TYPE_STYLES } from './lyricRender';
import {
  AUDIO_PALETTES,
  BACKGROUND_MODES,
  drawBackground,
  GRADIENT_PRESETS,
} from './lyricBackgrounds';
import { fontFamilyStack, loadCustomFont } from './lyricFonts';
import { EXPORT_SIZES, exportLyricVideo, linesToLrc, linesToSrt } from './lyricExport';
import LyricTimeline from './LyricTimeline';
import './lyric.css';

const LIMITS = [
  'Whisper tiny/base transcribes the full music mix, not an isolated vocal: expect it to miss or garble words under heavy instrumentation, ad-libs, names and backing vocals. Check the interpolated (unmatched) words below and nudge them by hand.',
  'Alignment assumes the pasted lyrics are reasonably accurate. Wildly wrong or out-of-order lyrics will misalign everything that comes after the mismatch.',
  'MP4 export uses WebCodecs where the browser supports it; otherwise it falls back to WebM, which plays everywhere but is a different container than MP4.',
  'The WebCodecs export path can render faster than real time. The WebM/MediaRecorder fallback records in real time and needs the tab to stay visible for the whole export.',
  "Optional vocal isolation reuses Split's 172 MB on-device HTDemucs model, is slow (minutes per song), and does not guarantee better alignment than running on the full mix.",
  'Nothing is saved automatically: download the video, LRC or SRT before leaving the page.',
  'One song at a time, built for desktop Chrome/Edge-class browsers. Phones and Safari are untested.',
];

const PREVIEW_MAX_WIDTH = 420;

export default function LyricPage() {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [mono, setMono] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [peaks, setPeaks] = useState(null);
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState('');

  const [lyricText, setLyricText] = useState('');
  const [isolateVocals, setIsolateVocals] = useState(false);
  const [aligning, setAligning] = useState(false);
  const [alignProgress, setAlignProgress] = useState(null);
  const [alignMessage, setAlignMessage] = useState('');
  const [alignError, setAlignError] = useState('');
  const [lines, setLines] = useState(null);

  const [styleId, setStyleId] = useState(TYPE_STYLES[0].id);
  const [backgroundMode, setBackgroundMode] = useState('gradient');
  const [paletteId, setPaletteId] = useState(AUDIO_PALETTES[0].id);
  const [gradientId, setGradientId] = useState(GRADIENT_PRESETS[0].id);
  const [gradientType, setGradientType] = useState('linear');
  const [customColors, setCustomColors] = useState(['#1a0b2e', '#ff5e7e']);
  const [useCustomGradient, setUseCustomGradient] = useState(false);
  const [mediaKind, setMediaKind] = useState(null);
  const [mediaError, setMediaError] = useState('');
  const [customFontFamily, setCustomFontFamily] = useState(null);
  const [fontError, setFontError] = useState('');

  const [exportSizeId, setExportSizeId] = useState(EXPORT_SIZES[0].id);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [exportError, setExportError] = useState('');

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selected, setSelected] = useState(null);

  const audioRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const mediaElementRef = useRef(null);
  const alignAbortRef = useRef(null);
  const whisperClientRef = useRef(null);

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      alignAbortRef.current?.abort();
      whisperClientRef.current?.dispose();
    },
    [audioUrl]
  );

  const choose = async (files) => {
    if (!files?.length || decoding) return;
    const picked = files[0];
    setDecodeError('');
    setDecoding(true);
    setLines(null);
    setFile(picked);
    try {
      const [monoResult, buffer] = await Promise.all([
        decodeMono(picked),
        decodeAudioBuffer(picked),
      ]);
      setMono(monoResult);
      setAudioBuffer(buffer);
      setPeaks(peaksOf(monoResult.samples));
      setAudioUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(picked);
      });
    } catch (error) {
      setDecodeError(error.message || 'Could not decode this file.');
      setFile(null);
    } finally {
      setDecoding(false);
    }
  };

  const cancelAlign = () => alignAbortRef.current?.abort();

  const runAlign = async () => {
    if (!mono || !lyricText.trim() || aligning) return;
    setAligning(true);
    setAlignError('');
    setAlignProgress(0);
    setAlignMessage('Starting...');
    const controller = new AbortController();
    alignAbortRef.current = controller;
    try {
      let source = mono;
      if (isolateVocals) {
        setAlignMessage('Isolating vocals (this can take a few minutes)...');
        const stemClient = new StemSeparatorClient();
        try {
          const trackAudio = await decodeStemTrack(file, controller.signal);
          const outputs = await stemClient.separate(
            trackAudio,
            ['vocals'],
            controller.signal,
            (progress) => setAlignMessage(progress?.message || 'Isolating vocals...'),
            () => {},
            false
          );
          const vocals = outputs.find((output) => output.id === 'vocals');
          if (vocals) source = await decodeMono(vocals.blob);
        } finally {
          stemClient.dispose();
        }
      }
      controller.signal.throwIfAborted();
      setAlignMessage('Downloading transcription model (first run only)...');
      const client = new LyricWhisperClient();
      whisperClientRef.current = client;
      const rawChunks = await client.transcribe(
        source.samples,
        source.rate,
        controller.signal,
        (progress) => {
          const percent = typeof progress?.progress === 'number' ? progress.progress / 100 : null;
          setAlignProgress(percent);
          if (progress?.status === 'progress' || progress?.file) {
            setAlignMessage(`Loading model: ${progress.file || ''}`.trim());
          } else if (percent === null) {
            setAlignMessage('Transcribing...');
          }
        }
      );
      setAlignMessage('Matching lyrics to the vocal...');
      const asrWords = normalizeAsrWords(rawChunks);
      const lyricTokens = tokenizeLyrics(lyricText);
      const aligned = alignLyricsToAsr(lyricTokens, asrWords, mono.duration);
      setLines(buildLyricLines(aligned));
      setSelected(null);
    } catch (error) {
      if (!controller.signal.aborted) setAlignError(error.message || 'Alignment failed.');
    } finally {
      setAligning(false);
      setAlignProgress(null);
      setAlignMessage('');
      alignAbortRef.current = null;
      whisperClientRef.current = null;
    }
  };

  const nudgeSelected = (deltaSeconds) => {
    if (!selected || !lines) return;
    setLines((previous) => nudgeWord(previous, selected.lineId, selected.wordId, deltaSeconds));
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  useEffect(() => {
    const video = mediaKind === 'video' ? mediaElementRef.current : null;
    if (!video) return;
    if (playing) void video.play().catch(() => {});
    else video.pause();
  }, [playing, mediaKind]);

  const renderFrame = useCallback(
    (ctx, time, width, height) => {
      const bgState =
        backgroundMode === 'audio-reactive'
          ? { samples: mono?.samples, rate: mono?.rate, time, paletteId }
          : backgroundMode === 'gradient'
            ? {
                type: gradientType,
                colors: useCustomGradient
                  ? customColors
                  : GRADIENT_PRESETS.find((p) => p.id === gradientId)?.colors,
              }
            : { element: mediaElementRef.current };
      drawBackground(ctx, backgroundMode, bgState, width, height);
      const activeLine = findActiveLine(lines || [], time);
      if (activeLine) {
        drawCaption(styleId, ctx, activeLine, time, width, height, {
          fontFamily: fontFamilyStack(customFontFamily),
          color: '#f5f5f5',
          activeColor: '#ffe066',
          baseline: 0.82,
        });
      }
    },
    [
      backgroundMode,
      mono,
      paletteId,
      gradientType,
      useCustomGradient,
      customColors,
      gradientId,
      lines,
      styleId,
      customFontFamily,
    ]
  );

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return undefined;
    let raf;
    const tick = () => {
      renderFrame(ctx, audioRef.current?.currentTime || 0, canvas.width, canvas.height);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [renderFrame]);

  const size = EXPORT_SIZES.find((s) => s.id === exportSizeId) || EXPORT_SIZES[0];
  const previewScale = Math.min(1, PREVIEW_MAX_WIDTH / size.width);
  const previewWidth = Math.round(size.width * previewScale);
  const previewHeight = Math.round(size.height * previewScale);

  const handleFontUpload = async (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    setFontError('');
    try {
      const family = await loadCustomFont(picked);
      setCustomFontFamily(family);
    } catch (error) {
      setFontError(error.message || 'Could not load this font.');
    }
  };

  const handleMediaUpload = async (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    setMediaError('');
    const url = URL.createObjectURL(picked);
    try {
      if (picked.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        await new Promise((resolve, reject) => {
          video.onloadeddata = resolve;
          video.onerror = () => reject(new Error('Could not load this video.'));
        });
        mediaElementRef.current = video;
        setMediaKind('video');
      } else {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('Could not load this image.'));
          img.src = url;
        });
        mediaElementRef.current = img;
        setMediaKind('image');
      }
      setBackgroundMode('media');
    } catch (error) {
      setMediaError(error.message || 'Could not load this file.');
    }
  };

  const baseFileName = file ? baseName(file.name) : 'lyric-video';

  const handleExportVideo = async () => {
    if (!lines || !mono || !audioBuffer || exporting) return;
    setExporting(true);
    setExportError('');
    setExportProgress(0);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const { blob, ext } = await exportLyricVideo({
        canvas,
        fps: 30,
        durationSeconds: mono.duration,
        drawFrame: renderFrame,
        audioBuffer,
        onProgress: (progress) => setExportProgress(progress?.progress ?? null),
      });
      downloadBlob(blob, `${baseFileName}-lyric-video.${ext}`);
    } catch (error) {
      setExportError(error.message || 'Export failed.');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const handleExportLrc = () => {
    if (!lines) return;
    downloadBlob(new Blob([linesToLrc(lines)], { type: 'text/plain' }), `${baseFileName}.lrc`);
  };

  const handleExportSrt = () => {
    if (!lines) return;
    downloadBlob(new Blob([linesToSrt(lines)], { type: 'text/plain' }), `${baseFileName}.srt`);
  };

  const activeLine = lines ? findActiveLine(lines, currentTime) : null;

  return (
    <AudioLabShell
      tool="lyric"
      title="Lyric"
      eyebrow="Sattari Studio lab"
      summary="Drop a song and paste the lyrics. Lyric aligns the words to the vocal on your device, lets you fix any timing by hand, then renders an animated lyric video with your choice of type style and background -- export MP4, LRC or SRT."
      description="Paste your lyrics, align them to a song on-device with Whisper, pick an animated caption style and background, then export an MP4 lyric video or LRC/SRT captions."
      limits={LIMITS}
    >
      <div className="alab-workspace">
        <LabDrop
          title={file ? 'Choose another song' : 'Add a song'}
          hint="WAV, MP3, FLAC, M4A, OGG -- one song at a time"
          disabled={decoding}
          onFiles={choose}
        />
        {decodeError && (
          <div className="alab-error" role="alert">
            <p>{decodeError}</p>
          </div>
        )}
        {decoding && (
          <p className="alab-note">
            <LoaderCircle className="alab-spin" size={14} aria-hidden="true" /> Decoding audio...
          </p>
        )}

        {file && mono && (
          <>
            <section className="alab-card" aria-label="Lyrics">
              <h2>Paste lyrics</h2>
              <textarea
                className="lyric-textarea"
                value={lyricText}
                onChange={(event) => setLyricText(event.target.value)}
                placeholder={'Paste the song lyrics here, one line per lyric line...'}
                rows={8}
                disabled={aligning}
              />
              <div className="alab-input-row">
                <label className="lyric-checkbox">
                  <input
                    type="checkbox"
                    checked={isolateVocals}
                    disabled={aligning}
                    onChange={(event) => setIsolateVocals(event.target.checked)}
                  />
                  Isolate vocals first (slower, may improve alignment -- experimental)
                </label>
              </div>
              <div className="alab-actions">
                {aligning ? (
                  <button type="button" className="alab-text-button" onClick={cancelAlign}>
                    <Square size={14} aria-hidden="true" /> Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    className="alab-button alab-primary"
                    disabled={!lyricText.trim()}
                    onClick={() => void runAlign()}
                  >
                    <Wand2 size={16} aria-hidden="true" /> Align lyrics
                  </button>
                )}
              </div>
              {aligning && (
                <div className="alab-progress" role="status">
                  <div>
                    <span>
                      <LoaderCircle className="alab-spin" size={14} aria-hidden="true" />{' '}
                      {alignMessage}
                    </span>
                    {alignProgress !== null && <span>{Math.round(alignProgress * 100)}%</span>}
                  </div>
                  <progress max="1" value={alignProgress === null ? undefined : alignProgress} />
                </div>
              )}
              {alignError && (
                <p className="alab-bad" role="alert">
                  {alignError}
                </p>
              )}
            </section>

            {lines && (
              <>
                <section className="alab-card" aria-label="Preview">
                  <h2>Live preview</h2>
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  />
                  <canvas
                    ref={previewCanvasRef}
                    width={previewWidth}
                    height={previewHeight}
                    className="lyric-preview-canvas"
                  />
                  <div className="alab-transport">
                    <button type="button" className="alab-play" onClick={togglePlay}>
                      {playing ? (
                        <Pause size={18} aria-hidden="true" />
                      ) : (
                        <Play size={18} aria-hidden="true" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max={mono.duration || 0}
                      step="0.01"
                      value={currentTime}
                      onChange={(event) => {
                        const time = Number(event.target.value);
                        if (audioRef.current) audioRef.current.currentTime = time;
                        setCurrentTime(time);
                      }}
                    />
                    <span className="alab-time">
                      {formatTime(currentTime)} / {formatTime(mono.duration)}
                    </span>
                  </div>
                </section>

                <section className="alab-card" aria-label="Timeline">
                  <h2>Timeline & timing</h2>
                  <LyricTimeline
                    lines={lines}
                    duration={mono.duration}
                    peaks={peaks}
                    currentTime={currentTime}
                    selected={selected}
                    onSelect={(lineId, wordId) => setSelected({ lineId, wordId })}
                    onNudge={(snapshot, lineId, wordId, delta) =>
                      setLines(nudgeWord(snapshot, lineId, wordId, delta))
                    }
                  />
                  {selected && (
                    <div className="alab-actions">
                      <span className="alab-note">Nudge selected word:</span>
                      <button
                        type="button"
                        className="alab-text-button"
                        onClick={() => nudgeSelected(-0.1)}
                      >
                        -100ms
                      </button>
                      <button
                        type="button"
                        className="alab-text-button"
                        onClick={() => nudgeSelected(-0.01)}
                      >
                        -10ms
                      </button>
                      <button
                        type="button"
                        className="alab-text-button"
                        onClick={() => nudgeSelected(0.01)}
                      >
                        +10ms
                      </button>
                      <button
                        type="button"
                        className="alab-text-button"
                        onClick={() => nudgeSelected(0.1)}
                      >
                        +100ms
                      </button>
                    </div>
                  )}
                  <div className="lyric-lines-list" role="list">
                    {lines.map((line) => (
                      <p
                        key={line.id}
                        role="listitem"
                        className={`lyric-line-row${activeLine?.id === line.id ? ' is-active' : ''}`}
                      >
                        {line.words.map((word) => (
                          <button
                            key={word.id}
                            type="button"
                            className={`lyric-word-chip${!word.matched ? ' is-interpolated' : ''}${
                              selected?.lineId === line.id && selected?.wordId === word.id
                                ? ' is-selected'
                                : ''
                            }`}
                            onClick={() => setSelected({ lineId: line.id, wordId: word.id })}
                            title={
                              word.matched
                                ? 'Aligned to the vocal'
                                : 'Interpolated (ASR missed this word)'
                            }
                          >
                            {word.text}
                          </button>
                        ))}
                      </p>
                    ))}
                  </div>
                </section>

                <section className="alab-card" aria-label="Style">
                  <h2>
                    <Type size={16} aria-hidden="true" /> Caption style
                  </h2>
                  <div className="lyric-picker-grid">
                    {TYPE_STYLES.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        className={`lyric-picker-tile${styleId === style.id ? ' is-selected' : ''}`}
                        onClick={() => setStyleId(style.id)}
                      >
                        {style.name}
                      </button>
                    ))}
                  </div>
                  <div className="alab-input-row">
                    <label className="alab-inline-select">
                      Custom font
                      <input
                        type="file"
                        accept=".ttf,.otf,.woff,.woff2"
                        onChange={(event) => void handleFontUpload(event)}
                      />
                    </label>
                    {customFontFamily && (
                      <span className="alab-note">Using {customFontFamily}</span>
                    )}
                  </div>
                  {fontError && (
                    <p className="alab-bad" role="alert">
                      {fontError}
                    </p>
                  )}
                </section>

                <section className="alab-card" aria-label="Background">
                  <h2>
                    <ImageIcon size={16} aria-hidden="true" /> Background
                  </h2>
                  <div className="lyric-picker-grid">
                    {BACKGROUND_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        className={`lyric-picker-tile${backgroundMode === mode.id ? ' is-selected' : ''}`}
                        onClick={() => setBackgroundMode(mode.id)}
                      >
                        {mode.name}
                      </button>
                    ))}
                  </div>
                  {backgroundMode === 'audio-reactive' && (
                    <div className="lyric-picker-grid">
                      {AUDIO_PALETTES.map((palette) => (
                        <button
                          key={palette.id}
                          type="button"
                          className={`lyric-picker-tile${paletteId === palette.id ? ' is-selected' : ''}`}
                          onClick={() => setPaletteId(palette.id)}
                        >
                          {palette.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {backgroundMode === 'gradient' && (
                    <>
                      <div className="alab-input-row">
                        <label className="alab-inline-select">
                          Shape
                          <select
                            value={gradientType}
                            onChange={(event) => setGradientType(event.target.value)}
                          >
                            <option value="solid">Solid</option>
                            <option value="linear">Linear gradient</option>
                            <option value="radial">Radial gradient</option>
                          </select>
                        </label>
                      </div>
                      {!useCustomGradient && (
                        <div className="lyric-picker-grid">
                          {GRADIENT_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              className={`lyric-picker-tile${gradientId === preset.id ? ' is-selected' : ''}`}
                              onClick={() => setGradientId(preset.id)}
                            >
                              {preset.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="alab-input-row">
                        <label className="lyric-checkbox">
                          <input
                            type="checkbox"
                            checked={useCustomGradient}
                            onChange={(event) => setUseCustomGradient(event.target.checked)}
                          />
                          Use custom colors
                        </label>
                        {useCustomGradient && (
                          <>
                            <input
                              type="color"
                              value={customColors[0]}
                              onChange={(event) =>
                                setCustomColors(([, second]) => [event.target.value, second])
                              }
                            />
                            <input
                              type="color"
                              value={customColors[1]}
                              onChange={(event) =>
                                setCustomColors(([first]) => [first, event.target.value])
                              }
                            />
                          </>
                        )}
                      </div>
                    </>
                  )}
                  {backgroundMode === 'media' && (
                    <div className="alab-input-row">
                      <label className="alab-inline-select">
                        Image or video
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={(event) => void handleMediaUpload(event)}
                        />
                      </label>
                      {mediaKind && <span className="alab-note">Using uploaded {mediaKind}</span>}
                    </div>
                  )}
                  {mediaError && (
                    <p className="alab-bad" role="alert">
                      {mediaError}
                    </p>
                  )}
                </section>

                <section className="alab-card" aria-label="Export">
                  <h2>
                    <Captions size={16} aria-hidden="true" /> Export
                  </h2>
                  <div className="alab-input-row">
                    <label className="alab-inline-select">
                      Aspect ratio
                      <select
                        value={exportSizeId}
                        onChange={(event) => setExportSizeId(event.target.value)}
                      >
                        {EXPORT_SIZES.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.id} ({option.width}x{option.height})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="alab-actions">
                    <button
                      type="button"
                      className="alab-button alab-primary"
                      disabled={exporting}
                      onClick={() => void handleExportVideo()}
                    >
                      {exporting ? (
                        <LoaderCircle className="alab-spin" size={16} aria-hidden="true" />
                      ) : (
                        <Download size={16} aria-hidden="true" />
                      )}{' '}
                      Export MP4
                    </button>
                    <button type="button" className="alab-button" onClick={handleExportLrc}>
                      <FileText size={16} aria-hidden="true" /> Export LRC
                    </button>
                    <button type="button" className="alab-button" onClick={handleExportSrt}>
                      <FileText size={16} aria-hidden="true" /> Export SRT
                    </button>
                  </div>
                  {exporting && (
                    <div className="alab-progress" role="status">
                      <div>
                        <span>Rendering video...</span>
                        {exportProgress !== null && (
                          <span>{Math.round(exportProgress * 100)}%</span>
                        )}
                      </div>
                      <progress
                        max="1"
                        value={exportProgress === null ? undefined : exportProgress}
                      />
                    </div>
                  )}
                  {exportError && (
                    <p className="alab-bad" role="alert">
                      {exportError}
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </AudioLabShell>
  );
}

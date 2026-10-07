import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileJson,
  FolderOpen,
  ImagePlus,
  Plus,
  Printer,
  RotateCcw,
  X,
} from 'lucide-react';
import LabShell from '../LabShell';
import { downloadBlob, safeFileName } from '../files';
import {
  buildPressHtml,
  DRAFT_KEY,
  embedFor,
  exampleDraft,
  normalizeDraft,
  safeUrl,
} from './pressHtml';
import { entryFile, useLockerOpen } from '../../suite/suiteKit';

const PHOTO_MAX = 900;

const LIMITATIONS = [
  'There is no hosting: you download one HTML file and upload it wherever you like (your site, Netlify Drop, GitHub Pages, a Linktree alternative).',
  'Players are embedded for YouTube, Spotify, SoundCloud, Apple Music and Vimeo links. Other links (Bandcamp, Tidal, etc.) show as plain links.',
  'PDF export uses your browser’s print dialog (choose “Save as PDF”). Embedded players do not print; their links are printed instead.',
  'Your draft is saved in this browser only. Use “Save draft file” to move it to another device.',
  'Fonts fall back to the reader’s system fonts; there are no custom typefaces or templates beyond dark/light and two layouts yet.',
];

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, PHOTO_MAX / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened. Try a JPG or PNG.'));
    };
    image.src = url;
  });
}

function ListEditor({ items, onChange, fields, addLabel, max, describe }) {
  const set = (index, key, value) =>
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  return (
    <div className="press-list">
      {items.map((item, index) => (
        <div
          key={index}
          className={`press-item${fields.some((field) => field.multiline) ? ' is-quote' : ''}`}
        >
          {fields.map(({ key, label, type = 'text', multiline }) =>
            multiline ? (
              <textarea
                key={key}
                aria-label={`${label} ${index + 1}`}
                placeholder={label}
                value={item[key]}
                rows={2}
                onChange={(event) => set(index, key, event.target.value)}
              />
            ) : (
              <input
                key={key}
                type={type}
                aria-label={`${label} ${index + 1}`}
                placeholder={label}
                value={item[key]}
                onChange={(event) => set(index, key, event.target.value)}
              />
            )
          )}
          <button
            type="button"
            className="press-remove"
            aria-label={`Remove ${describe} ${index + 1}`}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
      {items.length < max && (
        <button
          type="button"
          className="lab-button"
          onClick={() =>
            onChange([...items, Object.fromEntries(fields.map(({ key }) => [key, '']))])
          }
        >
          <Plus size={15} aria-hidden="true" /> {addLabel}
        </button>
      )}
    </div>
  );
}

export default function PressPage() {
  const [draft, setDraft] = useState(exampleDraft);
  const [html, setHtml] = useState(() => buildPressHtml(exampleDraft()));
  const [status, setStatus] = useState({ text: '' });
  const frame = useRef(null);
  const restored = useRef(false);

  useEffect(() => {
    try {
      const saved = storage()?.getItem(DRAFT_KEY);
      if (saved) setDraft(normalizeDraft(JSON.parse(saved)));
    } catch {
      /* ignore a broken draft */
    }
    restored.current = true;
  }, []);

  // Rebuild the preview after typing pauses, so players do not reload per key.
  useEffect(() => {
    const timer = setTimeout(() => {
      setHtml(buildPressHtml(draft));
      if (!restored.current) return;
      try {
        storage()?.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        setStatus({
          text: 'Browser storage is full, so this draft is not auto-saved. Use “Save draft file”.',
          error: true,
        });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [draft]);

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setContact = (key, value) =>
    setDraft((current) => ({ ...current, contact: { ...current.contact, [key]: value } }));

  // A photo sent from the Locker or another suite app (?tcc-open=).
  useLockerOpen('press', (entry) => {
    if (/^image\//.test(entry.type || '')) void onPhoto(entryFile(entry));
  });

  const onPhoto = async (file) => {
    if (!file) return;
    try {
      set('photo', await resizePhoto(file));
    } catch (error) {
      setStatus({ text: error.message, error: true });
    }
  };

  const base = safeFileName(draft.name, 'press-kit');

  const downloadHtml = () => {
    const page = buildPressHtml(draft);
    const name = `${base}-${draft.layout === 'bio' ? 'links' : 'epk'}.html`;
    downloadBlob(new Blob([page], { type: 'text/html' }), name);
    setStatus({ text: `Saved ${name} (${Math.round(page.length / 1024)} KB, one file).` });
  };

  const printPdf = () => {
    const view = frame.current?.contentWindow;
    if (!view) return;
    // The preview may be a keystroke behind; print exactly what is shown.
    view.focus();
    view.print();
  };

  const saveDraftFile = () =>
    downloadBlob(
      new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }),
      `${base}-press-draft.json`
    );

  const openDraftFile = async (file) => {
    if (!file) return;
    try {
      setDraft(normalizeDraft(JSON.parse(await file.text())));
      setStatus({ text: `Opened ${file.name}.` });
    } catch {
      setStatus({ text: 'That file is not a Press draft.', error: true });
    }
  };

  const trackHint = (url) => {
    if (!url.trim()) return '';
    if (!safeUrl(url)) return 'Not a web link';
    return embedFor(url) ? `${embedFor(url).provider} player` : 'Shown as a link';
  };

  return (
    <LabShell
      lab="press"
      name="Press"
      tagline="Build an electronic press kit or link-in-bio page. Download it as one HTML file or print it to PDF."
      limitations={LIMITATIONS}
      className="lab-press"
    >
      <div className="lab-workspace">
        <div className="lab-panel" role="group" aria-label="Press kit details">
          <h2>Artist</h2>
          <label className="lab-field">
            <span>Artist or band name</span>
            <input
              type="text"
              value={draft.name}
              maxLength={80}
              onChange={(event) => set('name', event.target.value)}
            />
          </label>
          <label className="lab-field">
            <span>Tagline</span>
            <input
              type="text"
              value={draft.tagline}
              maxLength={120}
              placeholder="Genre · role · city"
              onChange={(event) => set('tagline', event.target.value)}
            />
          </label>
          <label className="lab-field">
            <span>Location</span>
            <input
              type="text"
              value={draft.location}
              maxLength={80}
              onChange={(event) => set('location', event.target.value)}
            />
          </label>
          <div className="press-photo">
            {draft.photo && <img src={draft.photo} alt="" />}
            <label className="lab-drop" style={{ flex: 1 }}>
              <ImagePlus size={18} aria-hidden="true" />
              <strong>{draft.photo ? 'Replace photo' : 'Add a photo'}</strong>
              <input
                type="file"
                accept="image/*"
                aria-label="Artist photo"
                onChange={(event) => onPhoto(event.target.files?.[0])}
              />
            </label>
            {draft.photo && (
              <button
                type="button"
                className="press-remove"
                aria-label="Remove photo"
                onClick={() => set('photo', '')}
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
          <label className="lab-field">
            <span>Bio (blank line between paragraphs)</span>
            <textarea
              value={draft.bio}
              maxLength={5000}
              rows={6}
              onChange={(event) => set('bio', event.target.value)}
            />
          </label>

          <h2>Links</h2>
          <ListEditor
            items={draft.links}
            onChange={(value) => set('links', value)}
            fields={[
              { key: 'label', label: 'Label' },
              { key: 'url', label: 'https://…', type: 'url' },
            ]}
            addLabel="Add link"
            describe="link"
            max={16}
          />

          <h2>Tracks</h2>
          <ListEditor
            items={draft.tracks}
            onChange={(value) => set('tracks', value)}
            fields={[
              { key: 'title', label: 'Title' },
              { key: 'url', label: 'Spotify, YouTube, SoundCloud… URL', type: 'url' },
            ]}
            addLabel="Add track"
            describe="track"
            max={8}
          />
          {draft.tracks.some((track) => track.url.trim()) && (
            <ul className="lab-status">
              {draft.tracks
                .filter((track) => track.url.trim())
                .map((track, index) => (
                  <li key={index}>
                    {track.title || `Track ${index + 1}`}: {trackHint(track.url)}
                  </li>
                ))}
            </ul>
          )}

          <h2>Press quotes</h2>
          <ListEditor
            items={draft.quotes}
            onChange={(value) => set('quotes', value)}
            fields={[
              { key: 'text', label: 'Quote', multiline: true },
              { key: 'source', label: 'Source' },
            ]}
            addLabel="Add quote"
            describe="quote"
            max={8}
          />

          <h2>Contact</h2>
          <div className="lab-grid-2">
            {[
              ['booking', 'Booking email', 'email'],
              ['management', 'Management email', 'email'],
              ['press', 'Press email', 'email'],
              ['phone', 'Phone', 'tel'],
            ].map(([key, label, type]) => (
              <label key={key} className="lab-field">
                <span>{label}</span>
                <input
                  type={type}
                  value={draft.contact[key]}
                  onChange={(event) => setContact(key, event.target.value)}
                />
              </label>
            ))}
          </div>

          <h2>Style</h2>
          <div className="lab-row">
            <div className="lab-segment" role="group" aria-label="Layout">
              {[
                ['epk', 'Press kit'],
                ['bio', 'Link in bio'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={draft.layout === value}
                  onClick={() => set('layout', value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="lab-segment" role="group" aria-label="Theme">
              {[
                ['dark', 'Dark'],
                ['light', 'Light'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={draft.theme === value}
                  onClick={() => set('theme', value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="lab-row lab-field">
              Accent
              <input
                type="color"
                value={draft.accent}
                onChange={(event) => set('accent', event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="press-preview">
          <div className="lab-row">
            <button type="button" className="lab-button is-primary" onClick={downloadHtml}>
              <Download size={16} aria-hidden="true" /> Download HTML
            </button>
            <button type="button" className="lab-button" onClick={printPdf}>
              <Printer size={16} aria-hidden="true" /> Print / PDF
            </button>
          </div>
          <iframe
            ref={frame}
            title="Press kit preview"
            srcDoc={html}
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals"
          />
          <div className="lab-row">
            <button type="button" className="lab-button" onClick={saveDraftFile}>
              <FileJson size={16} aria-hidden="true" /> Save draft file
            </button>
            <label className="lab-button">
              <FolderOpen size={16} aria-hidden="true" /> Open draft file
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => openDraftFile(event.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              className="lab-button"
              onClick={() => {
                setDraft(exampleDraft());
                setStatus({ text: 'Started over from the example.' });
              }}
            >
              <RotateCcw size={16} aria-hidden="true" /> Start over
            </button>
          </div>
          <p className={`lab-status${status.error ? ' is-error' : ''}`} role="status">
            {status.text}
          </p>
        </div>
      </div>
    </LabShell>
  );
}

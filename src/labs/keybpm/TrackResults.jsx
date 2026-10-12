import { useEffect, useRef, useState } from 'react';
import { AudioLines, ChevronDown } from 'lucide-react';
import { formatTime } from '../audio/AudioLabParts';

function Track({ row, expanded, onSelect }) {
  const { file, status, result, fromReport } = row;
  const [url, setUrl] = useState('');
  const player = useRef(null);
  useEffect(() => {
    if (!expanded || !(file instanceof Blob)) { setUrl(''); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => { URL.revokeObjectURL(next); };
  }, [expanded, file]);
  return <article data-status={status} className={`keybpm-track${expanded ? ' is-selected' : ''}`}>
    <button className="keybpm-track-summary" type="button" onClick={onSelect} aria-expanded={expanded}>
      <span className="keybpm-track-icon"><AudioLines aria-hidden="true" /></span>
      <span className="keybpm-track-name"><strong>{file.name}</strong><small>{fromReport ? 'Saved report · source audio not included' : status === 'done' ? formatTime(result.duration) : status === 'analyzing' ? 'Measuring…' : status === 'error' ? 'Could not analyze' : 'Waiting'}</small></span>
      <span className="keybpm-track-metric">{result?.bpm ?? '—'}<small>BPM</small></span>
      <span className="keybpm-track-metric">{result?.key || '—'}<small>{result?.camelot || 'Key'}</small></span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    {expanded && <div className="keybpm-track-detail">
      {url && <audio ref={player} controls preload="metadata" src={url} aria-label={`Listen to ${file.name}`} />}
      {status === 'done' && <div className="keybpm-measurements">
        <section><span>Tempo</span><strong>{result.bpm ?? '—'} <small>BPM</small></strong><p>{result.tempoEvidence === 'supported' ? 'Supported pulse estimate' : result.tempoEvidence || 'No steady pulse found'}</p></section>
        <section><span>Musical key</span><strong>{result.key || 'Undetermined'}</strong><p>{result.keyEvidence === 'tentative' ? 'Tentative estimate' : result.keyEvidence === 'insufficient' ? 'Insufficient tonal evidence' : 'Global key estimate'}{result.alternative ? ` · Alternative: ${result.alternative}` : ''}</p></section>
        <section><span>Camelot</span><strong>{result.camelot || '—'}</strong><p>{result.rmsDb == null ? 'Level unavailable' : `${result.rmsDb} dB RMS`}</p></section>
      </div>}
      {result?.note && <p className="alab-note">{result.note}</p>}
      {fromReport && <p className="alab-note">Import the source track to listen and analyze it again. This report preserves measurements only.</p>}
    </div>}
  </article>;
}
export default function TrackResults({ rows, hasTracks }) {
  const [selected, setSelected] = useState(null);
  const active = rows.some(row => row.id === selected) ? selected : rows[0]?.id;
  if (!rows.length) return <p className="alab-empty">{hasTracks ? 'No tracks match this search.' : 'Add your music to see its key, tempo and Camelot code here.'}</p>;
  return <div className="keybpm-results" aria-label="Track analysis results">{rows.map(row => <Track key={row.id} row={row} expanded={row.id === active} onSelect={() => setSelected(row.id)} />)}</div>;
}

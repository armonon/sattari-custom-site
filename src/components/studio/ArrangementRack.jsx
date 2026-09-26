import { useEffect, useRef, useState } from 'react';
import { StudioPanel } from './StudioPanel';
import {
  EFFECTS,
  newEffect,
  validateEffects,
  diskPluginInventory,
  EFFECT_DRAG_TYPE,
} from '../../utils/arrangementEffects';
import { INSTRUMENTS } from '../../utils/arrangementInstruments';
import suite from '../../data/sattariSuiteCatalog.json';
import './ArrangementRack.css';

const presets = {
  mix: ['eq', 'comp'],
  create: ['heat', 'echo', 'space'],
  vocal: ['eq', 'comp', 'space'],
};
const key = 'sattari-local-plugin-catalog-v1';
function readInventory() {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data)
      ? data
          .filter(
            (item) =>
              typeof item?.name === 'string' &&
              typeof item?.format === 'string' &&
              typeof item?.path === 'string'
          )
          .slice(0, 1000)
      : [];
  } catch {
    return [];
  }
}
export default function ArrangementRack({
  tracks,
  selectedTrackId,
  busy,
  onEffects,
  onInstrument,
  onEditInstrument,
  onSelectTrack,
  revealToken,
  scope = 'track',
}) {
  const master = scope === 'master';
  const drag = (event, types) => {
    event.dataTransfer.setData(EFFECT_DRAG_TYPE, JSON.stringify(types));
    event.dataTransfer.effectAllowed = 'copy';
  };
  const [open, setOpen] = useState(true),
    [tab, setTab] = useState('effects'),
    [query, setQuery] = useState('');
  const [target, setTarget] = useState(selectedTrackId || ''),
    [inventory, setInventory] = useState(readInventory),
    [message, setMessage] = useState('');
  useEffect(() => {
    setOpen(true);
  }, [revealToken]);
  const folder = useRef(null),
    preset = useRef(null),
    panel = useRef(null);
  useEffect(() => {
    if (selectedTrackId) setTarget(selectedTrackId);
  }, [selectedTrackId]);
  const track = tracks.find((item) => item.id === target) || tracks[0],
    effects = track?.effects || [];
  const apply = (next, structural = false) => {
    try {
      validateEffects(next);
      if (track) onEffects(track.id, next, structural);
    } catch (error) {
      setMessage(error.message);
    }
  };
  const insert = (types) => {
    if (!track) {
      setMessage('Add an audio or instrument track before inserting effects.');
      return;
    }
    apply([...effects, ...types.map(newEffect)], true);
  };
  const importFolder = (files) => {
    try {
      const found = diskPluginInventory(files);
      const combined = [
        ...new Map([...inventory, ...found].map((item) => [item.path, item])).values(),
      ].slice(0, 1000);
      localStorage.setItem(key, JSON.stringify(combined));
      setInventory(combined);
      setTab('disk');
      setMessage(
        `${found.length} native plugin packages found. Names cataloged locally; these binaries cannot run in this browser.`
      );
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <StudioPanel
      panelId={master ? 'master-rack' : 'arrange-rack'}
      label={master ? 'Master effects' : 'Instruments & effects'}
      className="ae-rack"
      aria-label={master ? 'Master insert effects' : 'Arrangement effects and instruments'}
      ref={panel}
    >
      <div className="ae-rack-heading">
        <label>
          {master ? 'Output ' : 'Track '}
          <select
            aria-label={master ? 'Master rack output' : 'Device rack track'}
            value={track?.id || ''}
            disabled={busy || !tracks.length}
            onChange={(event) => {
              setTarget(event.target.value);
              onSelectTrack(event.target.value);
            }}
          >
            {!tracks.length && <option value="">Add a track first</option>}
            {tracks.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide devices' : 'Show devices'}
        </button>
      </div>
      {open && (
        <>
          <p className="ae-rack-routing">
            {master
              ? 'Full mix → master tone → insert effects → compressor → limiter → recording / speakers. Inserts affect every source; instruments belong on tracks.'
              : 'Clips / instrument → insert effects → track level → master output. Knobs and bypass work during playback; adding or reordering pauses playback. Drag a built-in effect onto Master output to process the whole mix.'}
          </p>
          <div className="ae-rack-workspace">
            <aside aria-label="Plugin browser">
              <input
                type="search"
                aria-label="Search instruments and effects"
                placeholder="Find a device…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="ae-rack-tabs" aria-label="Device categories">
                {[
                  ['effects', 'Effects'],
                  ['instruments', 'Instruments'],
                  ['suite', 'Sattari suite'],
                  ['disk', 'Desktop host required'],
                ]
                  .filter(([id]) => !master || id !== 'instruments')
                  .map(([id, label]) => (
                    <button
                      type="button"
                      key={id}
                      aria-pressed={tab === id}
                      onClick={() => setTab(id)}
                    >
                      {label}
                    </button>
                  ))}
              </div>
              <div className="ae-rack-browser-list">
                {['effects', 'instruments'].includes(tab) && (
                  <p>
                    <strong>Playable here</strong> · Built-in browser DSP. These devices can process
                    audio in this runtime.
                  </p>
                )}
                {tab === 'effects' &&
                  Object.entries(EFFECTS)
                    .filter(([, def]) =>
                      `${def.name} ${def.description}`.toLowerCase().includes(query.toLowerCase())
                    )
                    .map(([id, def]) => (
                      <button
                        type="button"
                        key={id}
                        aria-label={`Add ${def.name}`}
                        draggable={!busy}
                        onDragStart={(event) => drag(event, [id])}
                        disabled={busy || !track || effects.length >= 8}
                        onClick={() => insert([id])}
                      >
                        <strong>{def.name}</strong>
                        <span>{def.description}</span>
                        <small>Playable here · Web edition · Add +</small>
                      </button>
                    ))}
                {tab === 'instruments' &&
                  INSTRUMENTS.filter(([, name]) =>
                    name.toLowerCase().includes(query.toLowerCase())
                  ).map(([id, name]) => (
                    <button type="button" key={id} disabled={busy} onClick={() => onInstrument(id)}>
                      <strong>{name}</strong>
                      <span>Add instrument track +</span>
                    </button>
                  ))}
                {tab === 'suite' && (
                  <>
                    <p>
                      Suite catalog, not a list of installed playable plugins. Web editions below
                      use browser DSP, not the native plugin algorithms. Other products require a
                      native desktop host.
                    </p>
                    {suite
                      .filter((item) =>
                        `${item.name} ${item.category} ${item.suite}`
                          .toLowerCase()
                          .includes(query.toLowerCase())
                      )
                      .map((item) => (
                        <article key={item.id}>
                          <strong>{item.name}</strong>
                          <span>
                            {item.category} · {item.suite}
                          </span>
                          {EFFECTS[item.id] || presets[item.id] ? (
                            <button
                              type="button"
                              draggable={!busy}
                              onDragStart={(event) => drag(event, presets[item.id] || [item.id])}
                              disabled={
                                busy ||
                                !track ||
                                effects.length + (presets[item.id]?.length || 1) > 8
                              }
                              onClick={() => insert(presets[item.id] || [item.id])}
                            >
                              Playable here · Add web {presets[item.id] ? 'chain' : 'edition'}
                            </button>
                          ) : (
                            <small>
                              Desktop host required · Native edition is not playable here
                            </small>
                          )}
                        </article>
                      ))}
                  </>
                )}
                {tab === 'disk' && (
                  <>
                    <p>
                      <strong>Desktop host required.</strong> Choose your plugin folder to catalog
                      AU, VST, VST3 and CLAP packages. Files stay on your device. This is an
                      inventory—not a native plugin host.
                    </p>
                    <button type="button" disabled={busy} onClick={() => folder.current.click()}>
                      Choose plugin folder
                    </button>
                    <input
                      ref={folder}
                      type="file"
                      hidden
                      multiple
                      webkitdirectory=""
                      onChange={(event) => {
                        importFolder([...event.target.files]);
                        event.target.value = '';
                      }}
                    />
                    {inventory
                      .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
                      .map((item) => (
                        <article key={item.path}>
                          <strong>{item.name}</strong>
                          <span>{item.format} · Native host required</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = inventory.filter((row) => row.path !== item.path);
                              try {
                                localStorage.setItem(key, JSON.stringify(next));
                                setInventory(next);
                              } catch (error) {
                                setMessage(error.message);
                              }
                            }}
                          >
                            Remove from catalog
                          </button>
                        </article>
                      ))}
                    {!inventory.length && <p>No plugin folders selected.</p>}
                  </>
                )}
              </div>
            </aside>
            <div className="ae-rack-chain">
              <div className="ae-rack-chain-title">
                <strong>{track ? `${track.name} · Insert chain` : 'Your track devices'}</strong>
                <span>{effects.length} / 8</span>
              </div>
              {track?.clips?.some((clip) => clip.kind === 'midi') && (
                <div className="ae-rack-instrument">
                  <small>INSTRUMENT SOURCE</small>
                  <strong>
                    {[
                      ...new Set(
                        track.clips
                          .filter((clip) => clip.kind === 'midi')
                          .map(
                            (clip) =>
                              INSTRUMENTS.find(
                                ([id]) => id === (clip.instrument || 'triangle')
                              )?.[1] || clip.instrument
                          )
                      ),
                    ].join(' · ')}
                  </strong>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onEditInstrument?.(track.clips.find((clip) => clip.kind === 'midi').id)
                    }
                  >
                    Edit instrument & piano roll
                  </button>
                </div>
              )}
              {!effects.length && (
                <div className="ae-rack-empty">
                  <strong>Shape the sound here.</strong>
                  <p>
                    {master
                      ? 'Add an effect from the browser to process the whole mix.'
                      : 'Add an EQ, compressor, space or color from the browser. MIDI tracks use the same effects path.'}
                  </p>
                </div>
              )}
              <ol aria-label={master ? 'Master insert chain' : 'Track insert effects'}>
                {effects.map((effect, index) => (
                  <li key={effect.id} className={effect.bypass ? 'is-bypassed' : ''}>
                    <div className="ae-rack-device-heading">
                      <div className="ae-rack-device-title">
                        <span>{index + 1}</span>
                        <strong>{EFFECTS[effect.type].name}</strong>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Bypass ${EFFECTS[effect.type].name} ${index + 1}`}
                        aria-pressed={effect.bypass}
                        onClick={() =>
                          apply(
                            effects.map((item) =>
                              item.id === effect.id ? { ...item, bypass: !item.bypass } : item
                            )
                          )
                        }
                      >
                        {effect.bypass ? 'Bypassed' : 'On'}
                      </button>
                      <button
                        type="button"
                        disabled={busy || index === 0}
                        aria-label={`Move effect ${index + 1} earlier`}
                        onClick={() => {
                          const next = [...effects];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          apply(next, true);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={busy || index === effects.length - 1}
                        aria-label={`Move effect ${index + 1} later`}
                        onClick={() => {
                          const next = [...effects];
                          [next[index + 1], next[index]] = [next[index], next[index + 1]];
                          apply(next, true);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Remove effect ${index + 1}`}
                        onClick={() =>
                          apply(
                            effects.filter((item) => item.id !== effect.id),
                            true
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <div className="ae-rack-parameters">
                      {Object.entries(EFFECTS[effect.type].params).map(([param, spec]) => (
                        <label key={param}>
                          <span>
                            {spec.label}{' '}
                            <output>
                              {Number((effect.params[param] ?? spec.value).toFixed(3))}
                              {spec.unit}
                            </output>
                          </span>
                          <input
                            type="range"
                            aria-label={`${EFFECTS[effect.type].name} ${index + 1} ${spec.label}`}
                            disabled={busy}
                            min={spec.min}
                            max={spec.max}
                            step={spec.step}
                            value={effect.params[param] ?? spec.value}
                            onDoubleClick={() =>
                              apply(
                                effects.map((item) =>
                                  item.id === effect.id
                                    ? { ...item, params: { ...item.params, [param]: spec.value } }
                                    : item
                                )
                              )
                            }
                            onChange={(event) =>
                              apply(
                                effects.map((item) =>
                                  item.id === effect.id
                                    ? {
                                        ...item,
                                        params: {
                                          ...item.params,
                                          [param]: Number(event.target.value),
                                        },
                                      }
                                    : item
                                )
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="ae-rack-presets">
                <button
                  type="button"
                  disabled={busy || !effects.length}
                  onClick={() => {
                    const blob = new Blob(
                      [JSON.stringify({ format: 'sattari-web-rack-v1', effects }, null, 2)],
                      { type: 'application/json' }
                    );
                    const url = URL.createObjectURL(blob),
                      anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = 'sattari-rack.json';
                    anchor.click();
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                  }}
                >
                  Save rack preset
                </button>
                <button
                  type="button"
                  disabled={busy || !track}
                  onClick={() => preset.current.click()}
                >
                  Load rack preset
                </button>
                <input
                  ref={preset}
                  type="file"
                  accept=".json"
                  hidden
                  onChange={async (event) => {
                    const file = event.target.files[0];
                    event.target.value = '';
                    if (!file) return;
                    try {
                      if (file.size > 65536)
                        throw new Error('Rack presets must be smaller than 64 KB.');
                      const data = JSON.parse(await file.text());
                      if (data.format !== 'sattari-web-rack-v1')
                        throw new Error('Choose a Sattari web rack preset, not a plugin binary.');
                      validateEffects(data.effects);
                      apply(
                        data.effects.map((effect) => ({ ...effect, id: crypto.randomUUID() })),
                        true
                      );
                    } catch (error) {
                      setMessage(error.message);
                    }
                  }}
                />
                <small>
                  {master
                    ? 'Stored with your project · included in mixdown, not pre-master stems'
                    : 'Stored with your project · included in mixdown and track stems'}
                </small>
              </div>
            </div>
          </div>
          {message && <p role="status">{message}</p>}
        </>
      )}
    </StudioPanel>
  );
}

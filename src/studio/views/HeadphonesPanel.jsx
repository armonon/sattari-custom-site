import { memo, useEffect, useId, useState } from 'react';
import { Headphones } from 'lucide-react';
import { Knob } from '../../components/studio/StemDeckChannel';

const CUE_MODE_LABELS = { off: 'Off', split: 'Split', multichannel: 'Outputs 3–4' };

/** Audio outputs the page may route to, named once the browser reveals labels. */
function useOutputDevices(enabled) {
  const [outputs, setOutputs] = useState({ devices: [], note: '' });
  useEffect(() => {
    const media = globalThis.navigator?.mediaDevices;
    if (!enabled || !media?.enumerateDevices) return undefined;
    let active = true;
    const list = async () => {
      try {
        const found = (await media.enumerateDevices()).filter(
          (device) => device.kind === 'audiooutput' && device.deviceId !== 'default'
        );
        if (!active) return;
        setOutputs({
          devices: found.map((device, index) => ({
            id: device.deviceId,
            label: device.label || `Output ${index + 1}`,
          })),
          note: found.some((device) => !device.label)
            ? 'Device names appear once this site may use an audio input (Input inspector).'
            : '',
        });
      } catch {
        if (active) setOutputs({ devices: [], note: 'This browser could not list audio outputs.' });
      }
    };
    void list();
    media.addEventListener?.('devicechange', list);
    return () => {
      active = false;
      media.removeEventListener?.('devicechange', list);
    };
  }, [enabled]);
  return outputs;
}

/**
 * Headphone cue: mode, output device, cue/master mix and level. Preferences of
 * this device, not part of the saved session.
 */
function HeadphonesPanel({ headphones }) {
  const { cue, effectiveMode, capabilities, changeCue, chooseOutput } = headphones;
  const id = useId();
  const outputs = useOutputDevices(capabilities.sinkSelectable);
  const [choosing, setChoosing] = useState(false);
  const multichannelHelp = capabilities.multichannel
    ? `Cue plays on outputs 3 and 4 of this ${capabilities.maxChannelCount}-channel output.`
    : `Needs an output with 4 or more channels; this one has ${capabilities.maxChannelCount}.`;
  const fallback =
    effectiveMode !== cue.mode
      ? `${CUE_MODE_LABELS[cue.mode]} is unavailable on this output; cue is ${CUE_MODE_LABELS[effectiveMode] || effectiveMode}.`
      : '';
  return (
    <section role="group" aria-label="Headphones" className="sd-mixer-headphones">
      <header className="sd-mixer-strip-name">
        <Headphones size={15} aria-hidden="true" />
        <strong>HEADPHONES</strong>
      </header>
      <fieldset className="sd-mixer-cue-modes">
        <legend>Cue mode</legend>
        {Object.entries(CUE_MODE_LABELS).map(([mode, label]) => {
          const unavailable = mode === 'multichannel' && !capabilities.multichannel;
          return (
            <label key={mode} className={effectiveMode === mode ? 'is-active' : ''}>
              <input
                type="radio"
                name={`${id}-cue-mode`}
                value={mode}
                checked={effectiveMode === mode}
                disabled={unavailable}
                aria-describedby={
                  mode === 'multichannel'
                    ? `${id}-multichannel`
                    : mode === 'split'
                      ? `${id}-split`
                      : undefined
                }
                onChange={() => changeCue({ mode })}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </fieldset>
      <p className="sd-mixer-help" id={`${id}-split`}>
        Split: program left, cue right.
      </p>
      <p className="sd-mixer-help" id={`${id}-multichannel`}>
        Outputs 3–4: {multichannelHelp}
      </p>
      {fallback ? (
        <p className="sd-mixer-help is-warning" role="status">
          {fallback}
        </p>
      ) : null}
      {capabilities.sinkSelectable ? (
        <label className="sd-mixer-output">
          <span>Studio output (main + headphones)</span>
          <select
            aria-label="Studio output (main + headphones)"
            value={cue.deviceId}
            disabled={choosing}
            onChange={async (event) => {
              setChoosing(true);
              try {
                await chooseOutput(event.target.value);
              } finally {
                setChoosing(false);
              }
            }}
          >
            <option value="">System default</option>
            {outputs.devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
            {cue.deviceId && !outputs.devices.some((device) => device.id === cue.deviceId) ? (
              <option value={cue.deviceId}>Saved output</option>
            ) : null}
          </select>
          <small>
            Switches where the whole Studio plays: the main mix and the headphone cue move together.
          </small>
          {outputs.note ? <small>{outputs.note}</small> : null}
        </label>
      ) : null}
      <div className="sd-mixer-cue-knobs">
        <Knob
          label="CUE ↔ MST"
          ariaLabel="Cue mix, cue to master"
          value={cue.mix}
          onChange={(mix) => changeCue({ mix })}
          accent="#62f5c8"
        />
        <Knob
          label="LEVEL"
          ariaLabel="Headphone level"
          value={cue.level}
          onChange={(level) => changeCue({ level })}
          accent="#62f5c8"
        />
      </div>
    </section>
  );
}

export default memo(HeadphonesPanel);

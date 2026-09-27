import { METER_FLOOR_DB, meterFraction, useChannelMeter, useMeterStore } from '../mixer/meterStore';

const decibels = (db) => (db <= METER_FLOOR_DB ? '−∞' : db.toFixed(1).replace('-', '−'));

/**
 * A channel's peak and RMS bars, peak-hold line and clip LED. With the gain
 * reduction readout, the only mixer components that re-render on meter frames.
 */
export function ChannelMeter({ channel, label, orientation = 'vertical' }) {
  const store = useMeterStore();
  const { peak, rms, clip } = useChannelMeter(channel);
  const text =
    peak <= METER_FLOOR_DB
      ? 'Silent'
      : `Peak ${decibels(peak)} dB, RMS ${decibels(rms)} dB${clip ? ', clipped' : ''}`;
  return (
    <div className={`sd-channel-meter is-${orientation}`}>
      <button
        type="button"
        className={clip ? 'sd-clip-led is-clipped' : 'sd-clip-led'}
        disabled={!clip}
        aria-label={clip ? `Clear ${label} clip indicator` : `${label} has not clipped`}
        title={clip ? 'Clipped. Click to clear.' : 'Clip indicator'}
        onClick={() => store.clearClip(channel)}
      />
      <div
        className="sd-channel-meter-bar"
        role="meter"
        aria-label={label}
        aria-valuemin={METER_FLOOR_DB}
        aria-valuemax={0}
        aria-valuenow={Math.round(peak)}
        aria-valuetext={text}
        style={{ '--sd-meter-peak': meterFraction(peak), '--sd-meter-rms': meterFraction(rms) }}
      >
        <i className="sd-meter-peak" />
        <i className="sd-meter-rms" />
        <i className="sd-meter-hold" />
      </div>
    </div>
  );
}

/** Master limiter gain reduction, e.g. "GR −3.2 dB". */
export function GainReduction() {
  const { reduction } = useChannelMeter('master');
  return (
    <span className="sd-gain-reduction" title="Limiter gain reduction">
      GR {reduction > 0 ? `−${reduction.toFixed(1)}` : '0.0'} dB
    </span>
  );
}

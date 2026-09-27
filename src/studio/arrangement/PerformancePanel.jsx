import { memo } from 'react';
import PerformanceEvents from '../../components/studio/PerformanceEvents';
import { reconstructPerformance } from '../../utils/performanceReplay';
import { replaceCapture } from './projectEdits';

/** Captured-performance editor: take picker plus the event editor for that take. */
function PerformancePanel({ captures, captureSelection, busy, activeReplay, commands }) {
  const captureIndex = Math.min(
    Number(captureSelection || captures.length - 1),
    captures.length - 1
  );
  const capture = captures[captureIndex];
  return (
    <section className="sd-performance-editor" aria-label="Performance editor">
      <header>
        <strong>Captured performance</strong>
        {captures.length > 0 && (
          <select
            aria-label="Edit captured take"
            value={captureSelection || String(captures.length - 1)}
            onChange={(event) => commands.setCaptureSelection(event.target.value)}
          >
            {captures.map((item, index) => (
              <option key={item.id || item.assetId || index} value={index}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </header>
      {captures.length === 0 ? (
        <p>
          Capture a performance in Perform. Finish the take, then open it here to edit its events
          and build source lanes.
        </p>
      ) : (
        <PerformanceEvents
          key={capture.id || capture.assetId || capture.name}
          capture={capture}
          expanded
          disabled={busy}
          replaying={activeReplay === (capture.id || capture.assetId)}
          onReplay={(options) => void commands.replay(capture, false, options)}
          onRender={(options) => void commands.replay(capture, true, options)}
          onStop={commands.stopReplay}
          onChange={(nextCapture) =>
            commands.edit((next) => replaceCapture(next, captureIndex, nextCapture))
          }
          onBuild={() => {
            try {
              const result = reconstructPerformance(commands.getProject(), capture);
              commands.edit(result.project);
              commands.setMessage(
                `Source replay added, muted for comparison. Review: ${result.warnings.join('; ')}`
              );
            } catch (error) {
              commands.setMessage(error.message);
            }
          }}
        />
      )}
    </section>
  );
}

export default memo(PerformancePanel);

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import InputStrip from '../../components/studio/InputStrip';
import MasterOutput from '../../components/studio/MasterOutput';

/** Side inspector for the live input strip and the master output rail. */
export default function SessionInspector({
  inspector,
  onClose,
  getEngine,
  onChooseSource,
  onInputActive,
  session,
  actions,
  captureActive,
}) {
  const heading = useRef(null);
  useEffect(() => {
    if (inspector) heading.current?.focus();
  }, [inspector]);

  return (
    <aside
      id="session-inspector"
      className="sd-session-inspector"
      aria-label="Session inspector"
      hidden={!inspector}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header>
        <strong ref={heading} tabIndex={-1}>
          {inspector === 'input' ? 'Input' : 'Master output'}
        </strong>
        <button type="button" aria-label="Close inspector" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div hidden={inspector !== 'input'}>
        <InputStrip
          getEngine={getEngine}
          visible={inspector === 'input'}
          onChoose={onChooseSource}
          onActiveChange={onInputActive}
        />
      </div>
      <MasterOutput
        compact={false}
        visible={inspector === 'master'}
        getEngine={getEngine}
        settings={session.masterProcessing}
        onSettings={actions.setMasterProcessing}
        level={session.masterLevel}
        onLevel={actions.setMasterLevel}
        limiter={session.limiter}
        onLimiter={actions.setLimiter}
        compression={session.aiMaster}
        onCompression={actions.setAiMaster}
        captureActive={captureActive}
      />
    </aside>
  );
}

import { ArrowRightLeft } from 'lucide-react';
import { HANDOFF_SOURCE_KINDS } from '../../utils/toolHandoff';

/**
 * Says exactly what arrived from the other tool: which file, whether it is the
 * original song, a stem or a rendered mix, and which values the musician chose
 * themselves. Shown only when a same-tab transfer was actually received.
 */
export default function HandoffNotice({ handoff, destination, className = 'tool-handoff' }) {
  const user = handoff.user && (handoff.user.key || handoff.user.bpm) ? handoff.user : null;
  return (
    <div className={className} role="status">
      <ArrowRightLeft size={16} aria-hidden="true" />
      <p>
        <strong>
          {handoff.added === false ? 'Could not add' : 'Added'} from {handoff.from}:
        </strong>{' '}
        {handoff.label} <span>({HANDOFF_SOURCE_KINDS[handoff.kind]})</span>
        {user && (
          <>
            {' '}
            · Your choices: {[user.key, user.bpm && `${user.bpm} BPM`]
              .filter(Boolean)
              .join(', ')}{' '}
            (set by you, carried as labels)
          </>
        )}
        {handoff.added === false
          ? ` · ${destination} could not accept it. See the message below.`
          : ' · Transferred in this tab only; it is not synced elsewhere.'}
      </p>
    </div>
  );
}

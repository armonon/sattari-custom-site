import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Archive, Check, LoaderCircle, X } from 'lucide-react';
import {
  LOCKER_URL,
  clearLockerOffer,
  saveToLocker,
  suiteAppFor,
  useSuite,
  useSuiteKit,
} from './suiteKit';
import './suite.css';

/**
 * The shared thecreateco app menu. The box is reserved in CSS so the header
 * never shifts; it stays an empty box when the kit cannot load.
 */
export function SuiteMenu({ className = '' }) {
  const { pathname } = useLocation();
  useSuiteKit(suiteAppFor(pathname));
  return <tcc-suite-menu className={`tcc-suite-menu-slot ${className}`.trim()} />;
}

/**
 * "Save to Locker" for the file the user just exported. Appears after a
 * download on the studio pages once the suite kit is ready; never on its own.
 */
export function LockerOffer() {
  const { kit, offer } = useSuite();
  const [state, setState] = useState({ for: null, status: 'idle', message: '' });
  if (!kit || !offer) return null;
  const current = state.for === offer ? state : { for: offer, status: 'idle', message: '' };

  const save = async () => {
    setState({ for: offer, status: 'saving', message: '' });
    try {
      await saveToLocker(offer);
      setState({ for: offer, status: 'saved', message: '' });
    } catch (error) {
      setState({ for: offer, status: 'error', message: error.message });
    }
  };

  return (
    <div className="tcc-locker-offer" role="status">
      {current.status === 'saved' ? (
        <span>
          <Check size={15} aria-hidden="true" /> Saved to your Locker.{' '}
          <a href={LOCKER_URL} target="_blank" rel="noopener noreferrer">
            Open Locker
          </a>
        </span>
      ) : (
        <>
          <span className="tcc-locker-offer-name" title={offer.name}>
            {current.status === 'error' ? current.message : `Downloaded “${offer.name}”.`}
          </span>
          <button type="button" onClick={() => void save()} disabled={current.status === 'saving'}>
            {current.status === 'saving' ? (
              <LoaderCircle className="tcc-spin" size={15} aria-hidden="true" />
            ) : (
              <Archive size={15} aria-hidden="true" />
            )}{' '}
            Save to Locker
          </button>
        </>
      )}
      <button
        type="button"
        className="tcc-locker-offer-close"
        aria-label="Dismiss"
        onClick={clearLockerOffer}
      >
        <X size={15} aria-hidden="true" />
      </button>
      <small>Locker keeps files in this browser on this device.</small>
    </div>
  );
}

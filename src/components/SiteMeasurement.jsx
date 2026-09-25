import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  measurementBlocked,
  measurementPreference,
  setMeasurementPreference,
  trackSiteEvent,
} from '../utils/siteMeasurement';
import '../pages/MusicResources.css';

function usePreference() {
  const [preference, setPreference] = useState('pending');
  useEffect(() => {
    const update = () => setPreference(measurementBlocked() ? 'blocked' : measurementPreference());
    update();
    window.addEventListener('sattari-measurement-change', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('sattari-measurement-change', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return preference;
}
export function AnalyticsChoice() {
  const preference = usePreference();
  return (
    <div className="measurement-choice">
      <label>
        <input
          type="checkbox"
          checked={preference === 'allowed'}
          disabled={preference === 'blocked' || preference === 'pending'}
          onChange={(event) => setMeasurementPreference(event.target.checked)}
        />
        Allow anonymous usage counts
      </label>
      {preference === 'blocked' && <span>Disabled by your browser privacy signal.</span>}
    </div>
  );
}
export default function SiteMeasurement() {
  const { pathname } = useLocation();
  const preference = usePreference();
  useEffect(() => {
    trackSiteEvent('page_view');
  }, [pathname, preference]);
  useEffect(() => {
    const clicked = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      if (link.href.startsWith('tel:')) trackSiteEvent('contact_click');
      if (link.href.startsWith('https://www.google.com/maps/dir'))
        trackSiteEvent('directions_click');
    };
    document.addEventListener('click', clicked);
    return () => document.removeEventListener('click', clicked);
  }, []);
  if (
    preference !== null ||
    ['/cart', '/studio-booking', '/checkout/success', '/checkout/cancel'].includes(pathname)
  )
    return null;
  return (
    <aside className="measurement-notice" aria-label="Optional measurement">
      <p>
        Allow anonymous usage counts to help improve Sattari? No audio or form contents.{' '}
        <Link to="/privacy">Privacy choices</Link>
      </p>
      <button onClick={() => setMeasurementPreference(false)}>No thanks</button>
      <button onClick={() => setMeasurementPreference(true)}>Allow counts</button>
    </aside>
  );
}

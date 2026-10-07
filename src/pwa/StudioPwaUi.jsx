import { useEffect } from 'react';
import {
  applyUpdate,
  dismissOfflineReady,
  promptInstall,
  registerStudioWorker,
  useStudioPwa,
} from './studioPwa';
import './studioPwa.css';

/**
 * Update and "ready offline" notices for the studio apps. Registers the
 * service worker when a studio page mounts. Updates never apply on their own:
 * the new version waits until the user chooses Reload.
 */
export function StudioAppStatus() {
  const { updateReady, offlineReady } = useStudioPwa();
  useEffect(() => {
    void registerStudioWorker();
  }, []);
  useEffect(() => {
    if (!offlineReady) return undefined;
    const timer = window.setTimeout(dismissOfflineReady, 8000);
    return () => window.clearTimeout(timer);
  }, [offlineReady]);

  if (!updateReady && !offlineReady) return null;
  return (
    <div className="studio-pwa-toast" role="status">
      {updateReady ? (
        <>
          <span>A new version is ready.</span>
          <button type="button" onClick={applyUpdate}>
            Reload
          </button>
        </>
      ) : (
        <>
          <span>Ready to work offline on this device.</span>
          <button type="button" onClick={dismissOfflineReady} aria-label="Dismiss">
            OK
          </button>
        </>
      )}
    </div>
  );
}

/** "Install app" where the browser offers it (Chrome, Edge); nothing elsewhere. */
export function InstallAppButton({ className, children = 'Install app' }) {
  const { canInstall } = useStudioPwa();
  if (!canInstall) return null;
  return (
    <button type="button" className={className} onClick={() => void promptInstall()}>
      {children}
    </button>
  );
}

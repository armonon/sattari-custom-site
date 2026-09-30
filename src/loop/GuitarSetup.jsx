import { createContext, useContext, useState } from 'react';
import { DEFAULT_PROFILE, TUNINGS, validProfile, profileLabel } from './guitarProfile';

const Context = createContext({ profile: DEFAULT_PROFILE, setProfile: () => true });
export const useGuitarProfile = () => useContext(Context);
export function GuitarProfileProvider({ children }) {
  const [profile, update] = useState(() => {
    try {
      return validProfile(JSON.parse(localStorage.getItem('loop-guitar-profile-v1')));
    } catch {
      return DEFAULT_PROFILE;
    }
  });
  const setProfile = (next) => {
    const value = validProfile(next);
    update(value);
    try {
      localStorage.setItem('loop-guitar-profile-v1', JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };
  return <Context.Provider value={{ profile, setProfile }}>{children}</Context.Provider>;
}
export default function GuitarProfileSettings() {
  const { profile, setProfile } = useGuitarProfile();
  const [draft, setDraft] = useState(profile);
  const [message, setMessage] = useState('');
  return (
    <details className="lc-profile">
      <summary>
        Your guitar · {profileLabel(profile)} · {profile.handedness}-handed
      </summary>
      <div className="lc-fields">
        <label>
          Playing hand
          <select
            value={draft.handedness}
            onChange={(e) => setDraft({ ...draft, handedness: e.target.value })}
          >
            <option value="right">Right-handed</option>
            <option value="left">Left-handed</option>
          </select>
        </label>
        <label>
          Tuning
          <select
            value={draft.tuning}
            onChange={(e) => setDraft({ ...draft, tuning: e.target.value })}
          >
            {Object.entries(TUNINGS).map(([id, tuning]) => (
              <option key={id} value={id}>
                {tuning.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Capo
          <select
            value={draft.capo}
            onChange={(e) => setDraft({ ...draft, capo: Number(e.target.value) })}
          >
            {Array.from({ length: 8 }, (_, i) => (
              <option key={i} value={i}>
                {i ? `Fret ${i}` : 'No capo'}
              </option>
            ))}
          </select>
        </label>
        <button
          className="loop-button loop-button-secondary"
          type="button"
          onClick={() =>
            setMessage(
              setProfile(draft)
                ? 'Guitar setup saved on this device.'
                : 'Setup applies for this visit. Device storage is unavailable.'
            )
          }
        >
          Save guitar setup
        </button>
      </div>
      <p>
        Targets keep their sounding pitch. Frets are relative to your capo. Changing setup updates
        fingerings; notes outside your guitar’s range are flagged.
      </p>
      {message && <p role="status">{message}</p>}
    </details>
  );
}

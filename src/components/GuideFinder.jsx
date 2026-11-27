import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { guideCollections } from '../data/musicGuides';
import { buildGuideFinder, findGuideSections } from '../utils/guideFinder';

let loadedIndex;
function loadIndex() {
  if (!loadedIndex) {
    loadedIndex = import('../data/guideSearchPhrases.json')
      .then(({ default: phrases }) => buildGuideFinder(phrases, guideCollections))
      .catch((error) => {
        loadedIndex = undefined;
        throw error;
      });
  }
  return loadedIndex;
}

export default function GuideFinder() {
  const [text, setText] = useState('');
  const [index, setIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const active = text.trim().length >= 2;
  useEffect(() => {
    if (!active || index) return;
    let mounted = true;
    loadIndex().then(
      (data) => {
        if (mounted) {
          setIndex(data);
          setFailed(false);
        }
      },
      () => {
        if (mounted) setFailed(true);
      }
    );
    return () => {
      mounted = false;
    };
  }, [active, index]);
  const results = active && index ? findGuideSections(index, text) : [];
  return (
    <div className="guide-finder" role="search" aria-label="Search the music guides">
      <label htmlFor="guide-query">Search the guides</label>
      <div className="guide-finder-input">
        <Search size={19} aria-hidden="true" />
        <input
          id="guide-query"
          type="search"
          value={text}
          maxLength={200}
          placeholder="Try “how to tie oud strings”"
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div role="status" className={active ? 'guide-search-status' : undefined}>
        {active &&
          (index
            ? results.length
              ? 'Suggested passages'
              : 'No matching passage. Try an instrument name or browse the topics below.'
            : failed
              ? 'Guide search could not load. Browse the topics below.'
              : 'Finding passages…')}
      </div>
      {active && results.length > 0 && (
        <ul className="guide-finder-results">
          {results.map(({ path, title, section }) => (
            <li key={path}>
              <Link to={path === '/guides' ? '#guide-topics' : path}>
                <strong>{section || title}</strong>
                {section && <span>{title}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

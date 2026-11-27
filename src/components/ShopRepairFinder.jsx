import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { buildShopRepairIndex, findShopRepairTargets } from '../utils/shopRepairFinder';
import './ShopRepairFinder.css';

function Matches({ pages, query }) {
  const { products } = useInventory();
  const { pathname } = useLocation();
  const index = useMemo(() => buildShopRepairIndex(pages, products), [pages, products]);
  const results = findShopRepairTargets(index, query, 5);
  return (
    <>
      <p role="status">
        {results.length
          ? 'Suggested pages'
          : 'No matches. Try an instrument name or “string replacement”.'}
      </p>
      {results.length > 0 && (
        <ul>
          {results.map(({ path, title, section, kind }) => {
            const current = path === pathname;
            return (
              <li key={path}>
                <Link to={path} aria-current={current ? 'page' : undefined}>
                  <span>{section || title}</span>
                  <small>
                    {section ? title : kind}
                    {current && ' · Current page'}
                  </small>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function ShopRepairFinder() {
  const id = useId();
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState(null);
  const [error, setError] = useState(false);
  const active = query.trim().length >= 2;
  useEffect(() => {
    if (!active || pages) return;
    let live = true;
    import('../data/shopRepairSearch.json').then(
      (module) => {
        if (live) {
          setPages(module.default);
          setError(false);
        }
      },
      () => {
        if (live) setError(true);
      }
    );
    return () => {
      live = false;
    };
  }, [active, pages]);
  return (
    <div
      role="search"
      aria-label="Shop and repair search"
      className="shop-repair-finder"
      id="shop-repair-search"
    >
      <label htmlFor={id}>Find an instrument, strings or repair service</label>
      <div className="shop-repair-search-input">
        <Search size={19} aria-hidden="true" />
        <input
          type="search"
          id={id}
          placeholder="Try “guitar restringing cost”"
          maxLength={180}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {active &&
        (pages ? (
          <Matches pages={pages} query={query} />
        ) : (
          <p role="status">
            {error
              ? 'Search could not load. Use the links on this page to continue.'
              : 'Searching…'}
          </p>
        ))}
    </div>
  );
}

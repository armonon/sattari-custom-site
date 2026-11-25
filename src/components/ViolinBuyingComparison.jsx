import { Link } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { formatPriceRange } from '../data/catalog';
import { comparisonSpec } from '../data/catalogMerchandising';

const uses = {
  'brescia-acoustic-violin':
    'For a player taking acoustic lessons or joining a group that asks for a traditional violin. Try it with your teacher and listen across the room.',
  'chiara-wooden-electric-violin':
    'For a player who wants to amplify their sound. Try it through the amplifier you plan to use and ask what your headphone setup would require.',
};

export default function ViolinBuyingComparison({ action }) {
  const { productBySlug, isSoldOut, isTracked, status } = useInventory();
  const models = Object.keys(uses).map(productBySlug).filter(Boolean);
  return (
    <section className="resource-section violin-comparison" id="compare-violins">
      <h2>Compare acoustic and electric violins for a first lesson</h2>
      {models.length > 0 && (
        <div className="violin-comparison-grid">
          {models.map((model) => {
            const prices = model.sizes?.length
              ? model.sizes.map((size) => size.price)
              : [model.price];
            const tracked = isTracked(model);
            const showPrice = prices.every(Number.isFinite) && (status !== 'error' || tracked);
            return (
              <article key={model.slug}>
                <img src={model.image} alt={model.name} width="320" height="240" loading="lazy" />
                <h3>
                  <Link to={`/product/${model.slug}`}>{model.name}</Link>
                </h3>
                <p className="violin-comparison-price">
                  {showPrice ? formatPriceRange(model) : 'Ask the shop for the current price'}
                  {tracked && <> · {isSoldOut(model) ? 'Sold out online' : 'In stock online'}</>}
                </p>
                <p>{uses[model.slug]}</p>
                <p>{comparisonSpec(model, 'fit')}</p>
                <p>{comparisonSpec(model, 'included')}</p>
              </article>
            );
          })}
        </div>
      )}
      <Link className="resource-action" to={action.path}>
        {action.label}
      </Link>
    </section>
  );
}

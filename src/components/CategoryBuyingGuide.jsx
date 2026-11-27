import { Link } from 'react-router-dom';
import { formatPriceRange } from '../data/catalog';
import { categoryBuyingGuides, comparisonSpec } from '../data/catalogMerchandising';
import { instrumentShopping } from '../data/instrumentShopping';
import './CatalogBuyingHelp.css';

export default function CategoryBuyingGuide({ categoryKey, products, isSoldOut }) {
  const guide = categoryBuyingGuides[categoryKey];
  if (!guide) return null;
  const families = instrumentShopping[categoryKey]?.families;
  const catalog = new Map(
    products
      .filter((product) => product.category === categoryKey)
      .map((product) => [product.slug, product])
  );

  return (
    <section
      id="buying-guide"
      className="container catalog-buying-help"
      aria-labelledby="category-buying-title"
    >
      <h2 id="category-buying-title">{guide.title}</h2>
      <p>{guide.introduction}</p>
      {families && (
        <div
          className="catalog-comparison-scroll"
          role="region"
          aria-label="Instrument comparison"
          tabIndex={0}
        >
          <table className="catalog-comparison">
            <caption>
              Current catalog prices in U.S. dollars. Open a model for its full specifications and
              available options.
            </caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Fit and features</th>
                <th scope="col">Listed package</th>
                <th scope="col">Price (USD)</th>
              </tr>
            </thead>
            {families.map((family) => {
              const models = family.models.map((slug) => catalog.get(slug)).filter(Boolean);
              return (
                <tbody key={family.id}>
                  <tr className="catalog-family-row">
                    <th scope="rowgroup" colSpan={4}>
                      <h3 id={family.id}>{family.name}</h3>
                      <p>{family.advice}</p>
                    </th>
                  </tr>
                  {models.map((product) => (
                    <tr key={product.slug} className="catalog-model-row">
                      <th scope="row">
                        <Link to={`/product/${product.slug}`}>{product.name}</Link>
                      </th>
                      <td data-label="Fit and features">{comparisonSpec(product, 'fit')}</td>
                      <td data-label="Listed package">{comparisonSpec(product, 'included')}</td>
                      <td data-label="Price">
                        {formatPriceRange(product)}
                        {isSoldOut?.(product) && <small>Out of stock</small>}
                      </td>
                    </tr>
                  ))}
                  {!models.length && (
                    <tr>
                      <td colSpan={4}>
                        No models in this comparison are listed online right now.{' '}
                        <Link to="/visit">Contact the shop for availability.</Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
      <ul>
        {guide.questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
      <nav className="catalog-buying-links" aria-label="Related buying guidance">
        {guide.links.map((link) => (
          <Link key={link.to} to={link.to}>
            {link.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

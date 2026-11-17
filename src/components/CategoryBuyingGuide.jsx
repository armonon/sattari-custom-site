import { Link } from 'react-router-dom';
import { formatPriceRange } from '../data/catalog';
import {
  categoryBuyingGuides,
  comparisonProducts,
  comparisonSpec,
} from '../data/catalogMerchandising';
import './CatalogBuyingHelp.css';

export default function CategoryBuyingGuide({ categoryKey, products }) {
  const guide = categoryBuyingGuides[categoryKey];
  if (!guide) return null;
  const models = comparisonProducts(categoryKey, products);

  return (
    <section
      id="buying-guide"
      className="container catalog-buying-help"
      aria-labelledby="category-buying-title"
    >
      <p className="card-kicker">Find the right fit</p>
      <h2 id="category-buying-title">{guide.title}</h2>
      <p>{guide.introduction}</p>
      {models.length > 0 && (
        <div
          className="catalog-comparison-scroll"
          role="region"
          aria-label="Instrument comparison"
          tabIndex={0}
        >
          <table className="catalog-comparison">
            <caption>
              Details and prices from the current catalog. Check each product for available options.
            </caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Listed fit</th>
                <th scope="col">Listed package</th>
                <th scope="col">Price (USD)</th>
              </tr>
            </thead>
            <tbody>
              {models.map((product) => (
                <tr key={product.slug}>
                  <th scope="row">
                    <Link to={`/product/${product.slug}`}>{product.name}</Link>
                  </th>
                  <td>{comparisonSpec(product, 'fit')}</td>
                  <td>{comparisonSpec(product, 'included')}</td>
                  <td>{formatPriceRange(product)}</td>
                </tr>
              ))}
            </tbody>
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

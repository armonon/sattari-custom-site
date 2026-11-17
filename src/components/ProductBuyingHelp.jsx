import { Link } from 'react-router-dom';
import { BUSINESS } from '../data/siteSeo';
import { categoryBuyingGuides, productBuyingQuestions } from '../data/catalogMerchandising';
import './CatalogBuyingHelp.css';

export default function ProductBuyingHelp({ product }) {
  const questions = productBuyingQuestions[product.slug];
  if (!questions) return null;
  const guide = categoryBuyingGuides[product.category];

  return (
    <section className="container catalog-buying-help" aria-labelledby="product-fit-title">
      <p className="card-kicker">Before you choose</p>
      <h2 id="product-fit-title">Check the fit and what is included</h2>
      <ul>
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
      <nav className="catalog-buying-links" aria-label="Product buying help">
        <a href={BUSINESS.phoneHref}>Ask about this product: {BUSINESS.phoneDisplay}</a>
        {guide && <Link to={`/shop/${product.category}#buying-guide`}>{guide.title}</Link>}
        {product.slug === 'violin-strings' && (
          <Link to="/violin-strings-woodland-hills">Violin string fit and replacement</Link>
        )}
        {product.slug === 'violin-pickup-bridge' && (
          <Link to="/services/violin-repair-los-angeles">Ask about violin fitting</Link>
        )}
      </nav>
    </section>
  );
}

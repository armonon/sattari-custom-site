import { Link } from 'react-router-dom';
import { BUSINESS } from '../data/siteSeo';
import { categoryBuyingGuides, productBuyingQuestions } from '../data/catalogMerchandising';
import { instrumentShopping, modelBuyingAdvice } from '../data/instrumentShopping';
import './CatalogBuyingHelp.css';

export default function ProductBuyingHelp({ product }) {
  const questions = productBuyingQuestions[product.slug];
  if (!questions) return null;
  const guide = categoryBuyingGuides[product.category];
  const advice = modelBuyingAdvice[product.slug];
  const family = instrumentShopping[product.category]?.families.find((group) =>
    group.models.includes(product.slug)
  );

  return (
    <section className="container catalog-buying-help" aria-labelledby="product-fit-title">
      <h2 id="product-fit-title">{advice?.heading || 'Check the fit and what is included'}</h2>
      {advice && <p>{advice.tip}</p>}
      <ul>
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
      <nav className="catalog-buying-links" aria-label="Product buying help">
        <a href={BUSINESS.phoneHref}>Ask about this product: {BUSINESS.phoneDisplay}</a>
        {guide && <Link to={`/shop/${product.category}#buying-guide`}>{guide.title}</Link>}
        {advice && <Link to={advice.guide[1]}>{advice.guide[0]}</Link>}
        {family && (
          <Link to={`/shop/${product.category}#${family.id}`}>
            Shop {family.name.toLowerCase()}
          </Link>
        )}
        {product.slug === 'violin-strings' && (
          <>
            <Link to="/violin-strings-woodland-hills">Violin string fit and replacement</Link>
            <Link to="/services/violin-restringing-woodland-hills">
              Ask about violin restringing
            </Link>
          </>
        )}
        {product.slug === 'violin-pickup-bridge' && (
          <Link to="/services/violin-repair-los-angeles">Ask about violin fitting</Link>
        )}
      </nav>
    </section>
  );
}

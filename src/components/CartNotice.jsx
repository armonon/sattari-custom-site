import { useCart } from '../context/CartContext';

function plural(count, one, many) {
  return count === 1 ? one : many;
}

export function describeRemovedItems(items) {
  const names = items.map((item) => item.name).filter(Boolean);
  const unnamed = items.length - names.length;
  const parts = [...names];
  if (unnamed) {
    parts.push(`${unnamed} ${names.length ? 'other ' : ''}${plural(unnamed, 'item', 'items')}`);
  }
  const list =
    parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  const many = items.length > 1;
  return `${list} ${many ? 'are' : 'is'} no longer available, so we removed ${
    many ? 'them' : 'it'
  } from your cart.`;
}

// Explains changes the catalog forced on the cart, and entries that cannot be
// shown yet. Shared by the cart drawer and the cart page.
export default function CartNotice() {
  const {
    cartItems,
    catalogStatus,
    unavailableCount,
    refreshCatalog,
    removedItems,
    dismissRemovedItems,
  } = useCart();

  const notices = [];

  if (removedItems.length) {
    notices.push(
      <div className="cart-notice" key="removed">
        <p>{describeRemovedItems(removedItems)}</p>
        <button type="button" className="cart-notice-action" onClick={dismissRemovedItems}>
          Dismiss
        </button>
      </div>
    );
  }

  if (unavailableCount && catalogStatus === 'loading') {
    notices.push(
      <div className="cart-notice" key="loading">
        <p>
          Loading {unavailableCount} more {plural(unavailableCount, 'item', 'items')} in your cart…
        </p>
      </div>
    );
  } else if (unavailableCount) {
    notices.push(
      <div className="cart-notice" key="unavailable">
        <p>
          We couldn&apos;t load {unavailableCount} {plural(unavailableCount, 'item', 'items')} in
          your cart right now. {plural(unavailableCount, 'It is', 'They are')} still saved.
        </p>
        <button type="button" className="cart-notice-action" onClick={refreshCatalog}>
          Try again
        </button>
      </div>
    );
  } else if (catalogStatus === 'error' && cartItems.length) {
    notices.push(
      <div className="cart-notice" key="prices">
        <p>We couldn&apos;t load the latest catalog. Final prices are confirmed at checkout.</p>
      </div>
    );
  }

  // The live region stays mounted so screen readers announce notices that
  // appear after the cart first renders (e.g. once the catalog loads).
  return (
    <div className="cart-notices" role="status">
      {notices}
    </div>
  );
}

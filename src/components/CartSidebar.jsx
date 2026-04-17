import React from 'react';
import { useCart } from '../context/CartContext';

export default function CartSidebar({ onCheckout }) {
  const { cartItems, itemCount, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();

  return (
    <aside className="cart-sidebar">
      <h2>Your Cart</h2>
      {cartItems.length === 0 ? (
        <div className="cart-empty">Your cart is empty.</div>
      ) : (
        <ul className="cart-list">
          {cartItems.map((item) => (
            <li key={item.key} className="cart-item">
              <div className="cart-item-info">
                <div className="cart-item-title">{item.product.name}{item.size ? ` (${item.size})` : ''}</div>
                <div className="cart-item-price">${item.unitPrice.toFixed(2)}</div>
              </div>
              <div className="cart-item-controls">
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={item.quantity}
                  onChange={e => updateQuantity(item.key, e.target.value)}
                  className="cart-item-qty"
                />
                <button onClick={() => removeFromCart(item.key)} className="cart-item-remove">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="cart-summary">
        <div>Items: {itemCount}</div>
        <div>Subtotal: ${subtotal.toFixed(2)}</div>
      </div>
      <div className="cart-actions">
        <button onClick={clearCart} disabled={cartItems.length === 0}>Clear Cart</button>
        <button onClick={onCheckout} disabled={cartItems.length === 0} className="checkout-btn">Checkout</button>
      </div>
    </aside>
  );
}

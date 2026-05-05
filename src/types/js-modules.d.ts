declare module './context/CartContext' {
  export * from '@/context/CartContext';
}

declare module '../context/CartContext' {
  export * from '@/context/CartContext';
}

declare module '@context/CartContext' {
  import type { FC, ReactNode } from 'react';
  import type { CartContextValue } from '@/types';

  export const CartProvider: FC<{ children: ReactNode }>;
  export function useCart(): CartContextValue;
}

declare module '../data/catalog' {
  export * from '@data/catalog';
}

declare module '@data/catalog' {
  import type { Category, Product } from '@/types';

  export const categories: Category[];
  export const products: Product[];
  export function getProductBySlug(slug: string): Product | undefined;
  export function resolveSelectedOption(
    product: Product,
    selectedSize: string | null
  ): { size: string | null; unitPrice: number | null };
  export function formatPrice(value: number | null | undefined): string;
}

declare module './App' {
  import type { FC } from 'react';

  const App: FC;
  export default App;
}

declare module '@utils/stripe' {
  import type { CartItem } from '@/types';

  export function redirectToCheckout(input: { cartItems: CartItem[] }): Promise<void>;
}

declare module '@utils/checkout' {
  import type { CartItem, CheckoutSession, CheckoutSessionStatus } from '@/types';

  export function getCheckoutEndpoint(): string;
  export function getCheckoutStatusEndpoint(): string;
  export function createCheckoutSession(cartItems: CartItem[]): Promise<CheckoutSession>;
  export function fetchCheckoutSessionStatus(sessionId: string): Promise<CheckoutSessionStatus>;
}

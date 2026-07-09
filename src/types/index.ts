export interface Product {
  id: string;
  name: string;
  slug: string;
  category: 'cymbals' | 'sticks' | 'essentials' | 'violins' | 'guitar-bass';
  description: string;
  price?: number;
  sizes?: Array<{
    size: string;
    price: number;
    image?: string;
  }>;
  image?: string;
  gallery?: string[];
  colors?: Array<{
    name: string;
    hex: string;
  }>;
  specs: string[];
}

export interface Category {
  title: string;
  description: string;
  key: Product['category'];
}

export interface CartItem {
  key: string;
  slug: string;
  size: string | null;
  color: string | null;
  quantity: number;
  product: Product;
  unitPrice: number;
  lineTotal: number;
}

export interface CartEntry {
  slug: string;
  size?: string | null;
  color?: string | null;
  quantity?: number;
}

export interface CartContextValue {
  cartItems: CartItem[];
  itemCount: number;
  subtotal: number;
  addToCart: (item: CartEntry) => void;
  updateQuantity: (key: string, quantity: number | string) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
}

export interface CheckoutSession {
  id: string;
  url?: string;
}

export interface CheckoutSessionStatus {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  amount_total?: number | null;
  currency?: string | null;
}

export interface StripeCheckoutError {
  message: string;
  error?: Error;
}

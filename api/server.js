
// Express server for Stripe Checkout (ESM)
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

app.post('/api/create-checkout-session', async (req, res) => {
  const { cartItems } = req.body;
  // Map cart items to Stripe line items
  const line_items = cartItems.map(item => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.product.name,
        ...(item.size ? { description: item.size } : {}),
      },
      unit_amount: Math.round(item.unitPrice * 100),
    },
    quantity: item.quantity,
  }));

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: process.env.SUCCESS_URL || 'http://localhost:5173/success',
      cancel_url: process.env.CANCEL_URL || 'http://localhost:5173/cancel',
    });
    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Stripe server running on port ${PORT}`));

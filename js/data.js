/**
 * data.js — Epic Toyz Sample / Seed Data
 * ─────────────────────────────────────────
 * 20 realistic RC car products used as:
 *   1. localStorage fallback (when Supabase is not yet configured)
 *   2. Supabase seed data (admin can push this via dashboard)
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_CATEGORIES = [
  {
    id: 'drift-cars',
    name: 'Drift Cars',
    slug: 'drift-cars',
    description: 'High-performance drift machines engineered for precision sliding and sideways action.',
    icon: '🏎️',
    color: '#E63946',
    display_order: 1
  },
  {
    id: 'mini-rc',
    name: 'Mini RC Cars',
    slug: 'mini-rc',
    description: 'Compact, fast, and fun micro RC cars perfect for indoor play and tight spaces.',
    icon: '🚗',
    color: '#457B9D',
    display_order: 2
  },
  {
    id: 'hobby-grade',
    name: 'Hobby Grade',
    slug: 'hobby-grade',
    description: 'Professional-level RC cars with brushless motors and LiPo batteries for serious enthusiasts.',
    icon: '🏁',
    color: '#2ecc71',
    display_order: 3
  },
  {
    id: 'crawlers',
    name: 'Crawlers',
    slug: 'crawlers',
    description: 'Rugged rock crawlers built for extreme off-road terrain and slow-speed technical adventures.',
    icon: '🪨',
    color: '#e67e22',
    display_order: 4
  },
  {
    id: 'unique-rc',
    name: 'Unique RC',
    slug: 'unique-rc',
    description: 'Special RC vehicles with unique capabilities — from amphibious cars to wall climbers.',
    icon: '⭐',
    color: '#9b59b6',
    display_order: 5
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS (Empty list)
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_PRODUCTS = [];

// ─────────────────────────────────────────────────────────────────────────────
// TESTIMONIALS (for homepage)
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_TESTIMONIALS = [
  {
    id: 1,
    name: 'Arjun Sharma',
    location: 'Mumbai, Maharashtra',
    rating: 5,
    review: 'Ordered from Epic Toyz and it arrived in just 2 days! The packaging was excellent and customer support was incredibly helpful. Will definitely shop here again!',
    date: '2025-05-15',
    product: 'Drift Car',
    verified: true
  },
  {
    id: 2,
    name: 'Priya Venkataraman',
    location: 'Chennai, Tamil Nadu',
    rating: 5,
    review: 'Bought an RC car as a birthday gift for my son and he absolutely loves it! The customer support was incredibly helpful. Highly recommended!',
    date: '2025-04-28',
    product: 'Mini RC',
    verified: true
  },
  {
    id: 3,
    name: 'Rohit Gupta',
    location: 'Delhi, NCR',
    rating: 5,
    review: 'The quality of products at Epic Toyz is absolutely incredible. Fast shipping and authentic products. Highly recommended!',
    date: '2025-06-02',
    product: 'Hobby Grade',
    verified: true
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// FAQs
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_FAQS = [
  {
    id: 1,
    category: 'products',
    question: 'Which RC cars are suitable for beginners?',
    answer: 'For beginners we recommend starting with ready-to-run (RTR) models that are durable and easy to control. Please WhatsApp us your preferences and budget, and we\'ll suggest the perfect fit.'
  },
  {
    id: 2,
    category: 'ordering',
    question: 'How does WhatsApp ordering work?',
    answer: 'Simply click the "Order via WhatsApp" button on any product or cart page. This opens WhatsApp with a pre-filled message containing your order details. Send the message to our team at 6383793890, and we\'ll confirm availability, share payment instructions, and dispatch within 24 hours. It\'s the fastest way to place an order!'
  },
  {
    id: 3,
    category: 'shipping',
    question: 'What is the delivery time across India?',
    answer: 'Orders are dispatched within 1-2 business days. Delivery typically takes 3-5 business days for most metro cities (Mumbai, Delhi, Bengaluru, Chennai, Hyderabad, Pune) and 5-7 business days for other cities and towns. We ship through reputable courier partners like Delhivery, DTDC, and Blue Dart. You\'ll receive a tracking number via WhatsApp and email once dispatched.'
  },
  {
    id: 4,
    category: 'payment',
    question: 'Do you offer Cash on Delivery?',
    answer: 'Yes! Cash on Delivery (COD) is available for orders up to ₹5,000 in select pincodes. For COD availability, please contact us on WhatsApp at 6383793890 with your pincode. We also accept WhatsApp-based orders and direct bank transfers.'
  },
  {
    id: 5,
    category: 'products',
    question: 'Are spare parts available for all RC cars?',
    answer: 'We stock and source spare parts for a wide range of hobby-grade models. Please contact us on WhatsApp with your specific model details to check availability.'
  },
  {
    id: 6,
    category: 'products',
    question: 'What is the difference between brushed and brushless motors?',
    answer: 'Brushed motors are simpler, more affordable, and ideal for beginners. Brushless motors are more efficient, faster, require less maintenance, and have a longer lifespan, making them the preferred choice for hobbyists.'
  },
  {
    id: 7,
    category: 'shipping',
    question: 'Do you ship to all states in India?',
    answer: 'Yes! We ship across all 28 states and 8 union territories of India. We ship to all major cities, towns, and most rural areas reachable by courier. A flat shipping charge of ₹50 applies to all orders.'
  },
  {
    id: 8,
    category: 'payment',
    question: 'How do I pay for my WhatsApp order?',
    answer: 'Once you click "Order via WhatsApp", our team will confirm your order and provide our bank account details or UPI ID for direct transfer. Once the payment is complete, send us the transaction screenshot on WhatsApp, and we will immediately process and dispatch your order. We never ask for passwords or OTPs.'
  },
  {
    id: 9,
    category: 'ordering',
    question: 'How do I contact Epic Toyz for after-sales support?',
    answer: 'The fastest way to reach us is WhatsApp at 6383793890 — we typically respond within 30 minutes during business hours (Monday to Saturday, 9AM to 8PM IST). You can also email us at epictoyz.in@gmail.com for detailed queries.'
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Expose globally
// ─────────────────────────────────────────────────────────────────────────────
window.SAMPLE_DATA = {
  categories:   SAMPLE_CATEGORIES,
  products:     SAMPLE_PRODUCTS,
  testimonials: SAMPLE_TESTIMONIALS,
  faqs:         SAMPLE_FAQS
};

// ─────────────────────────────────────────────────────────────────────────────
// Seed localStorage on first visit (runs only when Supabase not configured)
// ─────────────────────────────────────────────────────────────────────────────
(function seedLocalStorage() {
  if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) return;

  // Clear products once to empty the store
  if (localStorage.getItem('et_products_cleared_v1') !== 'true') {
    localStorage.setItem('et_products', JSON.stringify([]));
    localStorage.setItem('et_products_cleared_v1', 'true');
  }

  if (localStorage.getItem('et_seeded') === 'true') return;

  localStorage.setItem('et_categories', JSON.stringify(SAMPLE_CATEGORIES));
  localStorage.setItem('et_orders',     JSON.stringify([]));
  localStorage.setItem('et_reviews',    JSON.stringify([]));
  localStorage.setItem('et_seeded',     'true');

  console.info('[EpicToyz] 📦 localStorage seeded with sample data. Configure Supabase to use cloud storage.');
})();

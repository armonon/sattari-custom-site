#!/bin/bash

# Sattari Music - Quick Start Setup Script
# Run this to get the project ready for development

echo "🥁 Sattari Music - Quick Start Setup"
echo "======================================"
echo ""

# Check Node version
NODE_VERSION=$(node -v)
echo "✓ Node version: $NODE_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Copy environment template
if [ ! -f ".env" ]; then
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env with your Stripe keys!"
else
    echo "✓ .env file already exists"
fi

# TypeScript check
echo ""
echo "🔍 Checking TypeScript..."
npm run type-check

# Linting
echo ""
echo "📋 Running linter..."
npm run lint

# Tests
echo ""
echo "🧪 Running tests..."
npm test

# Build
echo ""
echo "🔨 Building project..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "1. Update .env with your Stripe and Sentry keys"
echo "2. Run 'npm run dev' to start the dev server"
echo "3. Optional: run 'npm run dev:api' in another terminal for local checkout testing"
echo "4. Open http://localhost:5173 in your browser"
echo "5. For Netlify launch prep, review NETLIFY_STRIPE_LAUNCH_CHECKLIST.md"
echo ""
echo "📖 Documentation:"
echo "   - README.md - Project overview"
echo "   - DEPLOYMENT.md - Deployment guide"
echo "   - NETLIFY_STRIPE_LAUNCH_CHECKLIST.md - Production launch checklist"
echo ""

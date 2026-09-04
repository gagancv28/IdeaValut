# IdeaVault

**IdeaVault** is an AI-powered startup directory, investor matchmaking, and automated verification platform.

## 🚀 Features

- **Client Directory**: Browse startup listings, category tags, and verified profiles.
- **Founder Dashboard**: Track startup stats, manage listings, and receive AI Pitch Deck Insights (powered by Gemini AI).
- **Admin Control Room**: Real-time verification queue, status lifecycle management, platform controls, and audit trails.
- **Payment Integration**: Seamless tier upgrades and billing via Razorpay Checkout.
- **Data Synchronization**: Synchronized real-time status counts across admin layout and metrics cards.

## 🛠️ Architecture

Monorepo workspace structure:
- `apps/client`: Public directory & founder portal (React + Vite + TailwindCSS)
- `apps/admin`: Verification control room & system settings (React + Vite + TailwindCSS)
- `apps/server`: Node.js Express REST API backend integrated with Supabase & Google Gemini AI

## ⚙️ Quick Start

```bash
# Install dependencies
npm install

# Run all applications concurrently (Client on :5173, Admin on :5175, Server on :3001)
npm run dev
```

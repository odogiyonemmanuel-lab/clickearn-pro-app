# ClickEarn Pro

A production-ready full-stack **Click & Earn** web application built with React, Convex, and TypeScript.

## Features

- **Authentication** — Register, login, logout, forgot password via Convex Auth
- **Dashboard** — Wallet balance, earnings, referrals, task progress, notifications
- **Wallet** — Available/pending balance, transaction history
- **Referral System** — Unique codes, payment verification, configurable rewards
- **Read & Earn** — News & job posts with timed reading rewards
- **Click Tasks** — Sponsored tasks with cooldowns, daily limits, fraud detection
- **Watch & Earn** — Embedded video tasks with progress tracking
- **Daily Bonus** — Configurable 24-hour claim cooldown
- **Blog Posting** — User-submitted posts with admin moderation workflow
- **Marketplace** — Listings with images, categories, search, and editing
- **Chat Zone** — Real-time private messaging, images, read receipts, block/report
- **Cash-out** — Bank transfer requests with admin approval flow
- **Admin Panel** — Full dashboard, user/task/cashout management, settings
- **Notifications** — Real-time in-app notifications for all key events

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Convex, Convex Auth |
| Deployment | Vercel (frontend), Convex Cloud (backend) |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

Follow the prompts to create or link a Convex project. Copy the deployment URL.

### 3. Configure environment

```bash
cp .env.example .env.local
# Fill in VITE_CONVEX_URL from step 2
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deployment

### Convex Backend

```bash
npx convex deploy
```

### Vercel Frontend

1. Push to GitHub.
2. Import the repo on [vercel.com](https://vercel.com).
3. Add `VITE_CONVEX_URL` to Vercel environment variables.
4. Deploy.

## Admin Access

After registering, promote a user to admin via the Convex dashboard:

```
Convex dashboard → Data → users → find user → edit role to "admin"
```

## Project Structure

```
clickearn-pro/
├── convex/                # Backend (Convex)
│   ├── schema.ts          # Database schema
│   ├── auth.ts            # Auth provider config
│   ├── auth.config.ts     # Auth config
│   ├── users.ts           # User queries & mutations
│   ├── tasks.ts           # Task system
│   ├── referrals.ts       # Referral system
│   ├── cashouts.ts        # Cash-out requests
│   ├── transactions.ts    # Wallet transactions
│   ├── settings.ts        # Platform settings
│   ├── marketplace.ts     # Marketplace listings
│   ├── chat.ts            # Conversations
│   ├── messages.ts        # Chat messages
│   └── ...
├── src/                   # Frontend (React)
│   ├── components/        # Reusable components
│   ├── layouts/           # Page layouts
│   ├── pages/             # Route pages
│   ├── hooks/             # Custom React hooks
│   └── lib/               # Utilities
└── ...
```

## License

MIT

# My Finance

A modern, lightweight personal finance manager. Every user's data lives entirely in **their own Google account** — Google Sheets is the database and Google Drive stores receipts and reports. There is no server-side database to host or maintain.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (new-york style)
- **Auth.js (NextAuth v5)** with Google OAuth
- **Google Sheets API** + **Google Drive API** (`googleapis`)
- **TanStack Query** (server-state cache), **Zustand**-ready, **Zod** (validation)
- Deploys to **Vercel**

> The service layer is fully implemented on top of the Google Sheets/Drive
> repositories, and every UI page renders production-ready loading, empty, and
> error states.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# then fill in AUTH_SECRET and your Google OAuth credentials

# 3. Run the dev server
npm run dev
```

### Google Cloud setup

1. Create an OAuth 2.0 Client (type: Web application).
2. Enable the **Google Sheets API** and **Google Drive API**.
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-app>.vercel.app/api/auth/callback/google`
4. Requested scopes: `openid email profile`, `drive.file`, `spreadsheets`.

## Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start the dev server              |
| `npm run build`     | Production build                  |
| `npm run start`     | Run the production build          |
| `npm run lint`      | ESLint                            |
| `npm run typecheck` | TypeScript type-check (no emit)   |

## Project structure

```
src/
├── app/
│   ├── (auth)/sign-in/        # Google sign-in
│   ├── (dashboard)/           # Authenticated app shell + module pages
│   │   ├── dashboard/ expenses/ income/ accounts/ categories/ loans/ reports/ settings/
│   │   ├── layout.tsx  loading.tsx  error.tsx
│   └── api/                   # Route handlers (thin, validated)
│       ├── auth/[...nextauth]/  bootstrap/  dashboard/
│       ├── expenses/ income/ accounts/ categories/ loans/ loan-payments/
│       ├── receipts/ reports/
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   ├── layout/                # sidebar, header, nav, user menu
│   ├── shared/                # page header, empty/error states, stat card
│   ├── providers/             # theme, react-query, session, toaster
│   └── auth/                  # sign-in button
├── config/                    # site, navigation, Google schema constants
├── lib/
│   ├── auth/                  # session guard + token refresh
│   ├── google/                # authenticated Sheets/Drive clients + helpers
│   ├── services/              # domain logic
│   ├── schemas/               # Zod input contracts
│   ├── api-response.ts        # ok()/fail() envelope helpers
│   ├── errors.ts              # AppError taxonomy
│   └── utils.ts format.ts id.ts
├── types/                     # domain + api + next-auth augmentation
├── auth.ts                    # NextAuth config
└── middleware.ts              # route protection
```

## Security notes

- OAuth tokens are stored only in the **encrypted, HTTP-only session cookie**
  (JWT strategy) and are never exposed to the browser.
- All Google API calls run **server-side**; the access token is refreshed
  automatically before expiry.
- The app uses the least-privilege **`drive.file`** scope — it can only touch
  files it creates.

## License

Private.

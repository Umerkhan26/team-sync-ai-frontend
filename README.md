# TeamSync AI Frontend

React + Vite + TypeScript app for TeamSync AI.

## Stack

- React 19, Vite 8, TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Redux Toolkit, TanStack Query, React Router
- React Hook Form + Zod, Axios, Socket.IO client
- Radix UI primitives, Lucide icons, Sonner toasts

## Setup

Dependencies are already listed in `package.json`. From this folder:

```bash
npm install
```

Copy env if needed:

```bash
cp .env.example .env
```

Defaults:

- `VITE_API_URL=http://localhost:4000/api/v1`
- `VITE_SOCKET_URL=http://localhost:4000`

## Run

Start the backend on port `4000`, then:

```bash
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Oxlint |

## Seed login

If the backend seed has been run:

- Email: `admin@teamsync.local`
- Password: `Password123!`

## App routes

| Path | Page |
| --- | --- |
| `/` | Marketing landing |
| `/login` `/register` | Auth |
| `/verify-email` | Email verification |
| `/forgot-password` `/reset-password` | Password recovery |
| `/onboarding` | Create organization |
| `/app` | Dashboard |
| `/app/projects` | Projects |
| `/app/tasks` | Kanban board |
| `/app/chat` | Channels + messages |
| `/app/documents` | Documents |
| `/app/ai` | AI assistant |
| `/app/settings` | Profile, org, members |

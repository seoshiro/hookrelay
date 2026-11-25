import { createBrowserRouter } from 'react-router';
import { HeroPage } from './features/hero/HeroPage.tsx';
import { NotFound } from './features/console/NotFound.tsx';

// the landing page ships alone; console screens load on first navigation
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default });

export const router = createBrowserRouter([
  { path: '/', element: <HeroPage /> },
  {
    lazy: page(() => import('./features/console/ConsoleLayout.tsx').then((m) => ({ default: m.ConsoleLayout }))),
    hydrateFallbackElement: <div className="min-h-dvh bg-bg" aria-busy="true" />,
    children: [
      { path: '/dashboard', lazy: page(() => import('./features/dashboard/DashboardPage.tsx').then((m) => ({ default: m.DashboardPage }))) },
      { path: '/events', lazy: page(() => import('./features/inspector/InspectorPage.tsx').then((m) => ({ default: m.InspectorPage }))) },
      { path: '/events/:id', lazy: page(() => import('./features/inspector/InspectorPage.tsx').then((m) => ({ default: m.InspectorPage }))) },
      { path: '/dlq', lazy: page(() => import('./features/dlq/DlqPage.tsx').then((m) => ({ default: m.DlqPage }))) },
      { path: '/endpoints', lazy: page(() => import('./features/vault/VaultPage.tsx').then((m) => ({ default: m.VaultPage }))) },
    ],
  },
  { path: '*', element: <NotFound /> },
]);

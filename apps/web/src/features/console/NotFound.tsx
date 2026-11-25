import { Link } from 'react-router';
import { Brand } from '../../components/ui.tsx';

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[1320px] flex-col justify-between px-6 py-10 md:px-12">
      <Brand />
      <div>
        <span className="label">404 — Not delivered</span>
        <h1 className="display mt-6 text-[clamp(56px,9vw,120px)]">
          This page went
          <br />
          <em className="text-muted">to the dead letters.</em>
        </h1>
        <Link to="/dashboard" className="link-quiet mt-10 inline-block text-[14px]">
          Back to the console ↗
        </Link>
      </div>
      <span className="label">HookRelay</span>
    </main>
  );
}

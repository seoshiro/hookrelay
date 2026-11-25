import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { Brand } from '../../components/ui.tsx';

const LINKS = [
  ['/dashboard', '01', 'Sandbox', 'Simulate a payment, a failure, a replay'],
  ['/events', '02', 'Event inspector', 'Attempts, signatures, payloads'],
  ['/dlq', '03', 'Dead letters', 'Inspect and replay what failed'],
  ['/endpoints', '04', 'Endpoints & keys', 'SSRF guard, HMAC, alerts'],
] as const;

export const DOCS_URL = 'https://github.com/seoshiro/hookrelay#readme';

export function HeroHeader() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="relative z-30 mx-auto grid max-w-[1320px] grid-cols-[1fr_auto] items-center gap-4 px-6 pt-7 md:grid-cols-[1fr_auto_1fr] md:px-12">
      <Brand size="lg" />
      <div className="relative">
        <div className="flex border border-ink/25 bg-[rgba(23,20,15,0.55)] backdrop-blur-md">
          <button
            ref={button}
            type="button"
            aria-expanded={open}
            aria-controls="hero-menu"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-10 items-center gap-2.5 px-4 text-[13px] text-ink/90 transition-colors hover:text-ink"
          >
            {open ? <X size={15} strokeWidth={1.5} /> : <Menu size={15} strokeWidth={1.5} />}
            Menu
          </button>
          <Link to="/dashboard" className="hidden h-10 items-center bg-ink px-5 text-[13px] font-medium text-bg transition-colors hover:bg-[#f6efe2] sm:inline-flex">
            Try sandbox
          </Link>
        </div>
        <AnimatePresence>
          {open && (
            <motion.nav
              id="hero-menu"
              aria-label="Sections"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-12 right-0 w-[min(88vw,380px)] border border-ink/15 bg-[rgba(23,20,15,0.94)] backdrop-blur-md md:left-1/2 md:-translate-x-1/2"
            >
              <ul>
                {LINKS.map(([to, n, title, note]) => (
                  <li key={to} className="border-b border-line last:border-0">
                    <Link to={to} className="grid grid-cols-[28px_1fr] gap-x-3 px-5 py-4 transition-colors hover:bg-surface">
                      <span className="label num pt-1.5">{n}</span>
                      <span className="font-serif text-[24px] leading-none">{title}</span>
                      <span />
                      <span className="mt-1.5 text-[12px] text-muted">{note}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
      <a href={DOCS_URL} target="_blank" rel="noreferrer" className="hidden h-10 items-center justify-self-end border border-ink/35 px-5 text-[13px] text-ink/90 transition-colors hover:border-ink md:inline-flex">
        Read docs ↗
      </a>
    </header>
  );
}

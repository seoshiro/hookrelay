import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import type { EventStatus } from '@hookrelay/shared';
import { statusLabel, statusTone } from '../lib/format.ts';

export function Brand({ to = '/', size = 'md' }: { to?: string; size?: 'md' | 'lg' }) {
  return (
    <Link to={to} className={`font-serif tracking-[-0.01em] ${size === 'lg' ? 'text-[28px]' : 'text-[24px]'} leading-none`} aria-label="HookRelay home">
      HookRelay<span className="text-accent">.</span>
    </Link>
  );
}

type Variant = 'primary' | 'outline' | 'ghost';
const variants: Record<Variant, string> = {
  // disabled primary drops to an outline instead of a muddy grey block
  primary: 'bg-ink text-bg border-ink hover:bg-[#f6efe2] disabled:bg-transparent disabled:text-faint disabled:border-line-strong disabled:opacity-100',
  outline: 'border-line-strong text-ink hover:border-ink',
  ghost: 'border-transparent text-muted hover:text-ink',
};

export function Button({ variant = 'outline', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`inline-flex h-[38px] items-center justify-center gap-2 border px-[18px] text-[13px] font-medium whitespace-nowrap transition-colors duration-200 disabled:opacity-40 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function StatusMark({ status, code }: { status: EventStatus; code?: number | null }) {
  return (
    <span className={`num inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] ${statusTone[status]}`}>
      <span aria-hidden className={`size-1.5 rounded-full bg-current ${status === 'PROCESSING' ? 'animate-pulse' : ''}`} />
      {statusLabel(status, code ?? null)}
    </span>
  );
}

export function Masthead({ index, title, aside, meta }: { index: string; title: ReactNode; aside?: ReactNode; meta?: string }) {
  return (
    <header className="hairline grid gap-8 border-b pt-12 pb-9 md:grid-cols-[1fr_minmax(0,360px)] md:items-end md:gap-12 md:pt-14">
      <div>
        <div className="mb-7 flex justify-between gap-4">
          <span className="label">{index}</span>
          {meta && <span className="label num hidden sm:inline">{meta}</span>}
        </div>
        <h1 className="display text-[clamp(48px,7vw,96px)]">{title}</h1>
      </div>
      {aside && <div className="max-w-[38ch] text-[15px] text-muted">{aside}</div>}
    </header>
  );
}

export function Panel({ label, right, children, className = '' }: { label?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-5 ${className}`}>
      {(label || right) && (
        <div className="flex items-baseline justify-between gap-4">
          {label && <span className="label">{label}</span>}
          {right && <span className="label num">{right}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function SerifHeading({ children, as: Tag = 'h2' }: { children: ReactNode; as?: 'h2' | 'h3' }) {
  return <Tag className="font-serif text-[30px] leading-none tracking-[-0.02em]">{children}</Tag>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-[13px] text-muted">{children}</p>;
}

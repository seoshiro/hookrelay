import { useId, type KeyboardEvent } from 'react';

/** Large serif section tabs: the active word in ivory, the rest in faint taupe. */
export function EditorialTabs<T extends string>({ tabs, value, onChange, label }: { tabs: readonly T[]; value: T; onChange: (t: T) => void; label: string }) {
  const id = useId();
  const move = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length]!;
    onChange(t);
    document.getElementById(`${id}-${t}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-x-8 gap-y-2">
      {tabs.map((t, i) => (
        <button
          key={t}
          id={`${id}-${t}`}
          role="tab"
          type="button"
          aria-selected={t === value}
          tabIndex={t === value ? 0 : -1}
          onKeyDown={(e) => move(e, i)}
          onClick={() => onChange(t)}
          className={`display text-[clamp(40px,5.4vw,72px)] transition-colors duration-300 ${t === value ? 'text-ink' : 'text-faint hover:text-muted'}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return { copied, copy };
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const { copied, copy } = useCopy();
  return (
    <button type="button" onClick={() => void copy(text)} className="inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-ink" aria-label={`${label} to clipboard`}>
      {copied ? <Check size={13} strokeWidth={1.5} /> : <Copy size={13} strokeWidth={1.5} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/** Sunken mono block for payloads and response traces. */
export function CodeBlock({ code, title, maxHeight = 360 }: { code: string; title?: string; maxHeight?: number }) {
  return (
    <div className="hairline border bg-sunken">
      <div className="hairline flex items-center justify-between border-b px-4 py-2.5">
        <span className="label">{title ?? 'Payload'}</span>
        <CopyButton text={code} />
      </div>
      <pre className="num overflow-auto px-4 py-4 text-[12px] leading-[1.7] text-[#d9cfbf]" style={{ maxHeight }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const pretty = (v: unknown) => {
  if (typeof v === 'string') {
    try {
      return JSON.stringify(JSON.parse(v), null, 2);
    } catch {
      return v;
    }
  }
  return JSON.stringify(v, null, 2);
};

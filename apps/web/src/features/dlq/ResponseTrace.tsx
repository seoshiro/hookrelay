import { useEvent } from '../../api/hooks.ts';
import { CodeBlock, pretty } from '../../components/CodeBlock.tsx';

/** The last response the receiver gave before the event was dead-lettered. */
export function ResponseTrace({ id }: { id: string }) {
  const { data } = useEvent(id);
  const last = data?.attempts.at(-1);
  const trace = last
    ? pretty({ event: id, attempt: last.attemptNumber, status: last.responseStatus, latencyMs: last.latencyMs, error: last.errorMessage, body: tryParse(last.responseBody) })
    : 'Loading…';
  return (
    <section aria-label="Response body trace" className="pt-10">
      <CodeBlock title={`Response body trace · ${id}`} code={trace} maxHeight={240} />
    </section>
  );
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

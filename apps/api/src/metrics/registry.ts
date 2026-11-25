const BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** Minimal Prometheus registry: a few counters and one histogram don't justify a dependency. */
export class Metrics {
  readonly eventsTotal = new Map<string, number>();
  dlqTotal = 0;
  private readonly hist = { buckets: BUCKETS.map(() => 0), sum: 0, count: 0 };

  incEvent(status: string): void {
    this.eventsTotal.set(status, (this.eventsTotal.get(status) ?? 0) + 1);
    if (status === 'DLQ') this.dlqTotal++;
  }

  observeDelivery(ms: number): void {
    BUCKETS.forEach((b, i) => {
      if (ms <= b) this.hist.buckets[i]!++;
    });
    this.hist.sum += ms;
    this.hist.count++;
  }

  render(queueDepth: number): string {
    const lines = [
      '# HELP hookrelay_events_total Webhook events by resulting status.',
      '# TYPE hookrelay_events_total counter',
      ...[...this.eventsTotal].map(([s, v]) => `hookrelay_events_total{status="${s}"} ${v}`),
      '# HELP hookrelay_delivery_duration_ms Outbound delivery latency.',
      '# TYPE hookrelay_delivery_duration_ms histogram',
      ...BUCKETS.map((b, i) => `hookrelay_delivery_duration_ms_bucket{le="${b}"} ${this.hist.buckets[i]}`),
      `hookrelay_delivery_duration_ms_bucket{le="+Inf"} ${this.hist.count}`,
      `hookrelay_delivery_duration_ms_sum ${this.hist.sum}`,
      `hookrelay_delivery_duration_ms_count ${this.hist.count}`,
      '# HELP hookrelay_queue_depth Events waiting for delivery.',
      '# TYPE hookrelay_queue_depth gauge',
      `hookrelay_queue_depth ${queueDepth}`,
      '# HELP hookrelay_dlq_total Events moved to the dead-letter queue.',
      '# TYPE hookrelay_dlq_total counter',
      `hookrelay_dlq_total ${this.dlqTotal}`,
    ];
    return lines.join('\n') + '\n';
  }
}

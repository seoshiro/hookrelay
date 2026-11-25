// zod-free: the web bundle imports these without pulling the schema library in.
export const EVENT_STATUSES = ['PENDING', 'PROCESSING', 'DELIVERED', 'RETRYING', 'DLQ'] as const;
export const PROVIDERS = ['stripe', 'github', 'telegram', 'custom'] as const;
export const SCENARIOS = ['ok_payment', 'fail_500_to_dlq', 'flaky_recover'] as const;

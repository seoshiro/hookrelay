import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.ts';
import type { ApiKeyView, SourceView } from '../../api/hooks.ts';

export function useSources(enabled: boolean) {
  return useQuery({ queryKey: ['sources'], queryFn: () => api<{ sources: SourceView[] }>('/api/sources').then((r) => r.sources), enabled });
}

export function useApiKeys(enabled: boolean) {
  return useQuery({ queryKey: ['api-keys'], queryFn: () => api<{ keys: ApiKeyView[] }>('/api/api-keys').then((r) => r.keys), enabled });
}

export function useSsrfCheck() {
  return useMutation({
    mutationFn: (url: string) => api<{ ok: true; addresses: string[] } | { ok: false; code: string; message: string }>('/api/endpoints/check', { method: 'POST', body: { url } }),
  });
}

export function useVaultMutations() {
  const qc = useQueryClient();
  const refresh = (key: string) => () => void qc.invalidateQueries({ queryKey: [key] });
  return {
    createKey: useMutation({
      mutationFn: (name: string) => api<{ secret: string }>('/api/api-keys', { method: 'POST', body: { name, scopes: ['read', 'replay'] } }),
      onSuccess: refresh('api-keys'),
    }),
    revokeKey: useMutation({ mutationFn: (id: string) => api(`/api/api-keys/${id}`, { method: 'DELETE' }), onSuccess: refresh('api-keys') }),
    createSource: useMutation({
      mutationFn: (body: { name: string; targetUrl: string }) => api<{ source: SourceView; signingSecret: string }>('/api/sources', { method: 'POST', body }),
      onSuccess: refresh('sources'),
    }),
    updateSource: useMutation({
      mutationFn: ({ id, ...body }: { id: string; telegramBotToken?: string | null; telegramChatId?: string | null; targetUrl?: string }) =>
        api<{ source: SourceView }>(`/api/sources/${id}`, { method: 'PATCH', body }),
      onSuccess: refresh('sources'),
    }),
    revealSecret: useMutation({ mutationFn: (id: string) => api<{ signingSecret: string }>(`/api/sources/${id}/reveal-secret`, { method: 'POST' }) }),
    rotateSecret: useMutation({ mutationFn: (id: string) => api<{ signingSecret: string }>(`/api/sources/${id}/rotate-secret`, { method: 'POST' }) }),
    testTelegram: useMutation({ mutationFn: (endpointId: string) => api(`/api/endpoints/${endpointId}/test-telegram`, { method: 'POST' }) }),
  };
}

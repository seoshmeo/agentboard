import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Item, Project, DecisionLog, Comment, ItemContext, CreateProjectResponse, TransitionRequest } from '@agentboard/shared';

const API_BASE = '/api';

function getApiKey(): string {
  return localStorage.getItem('agentboard_api_key') || '';
}

export function setApiKey(key: string) {
  localStorage.setItem('agentboard_api_key', key);
}

export function getStoredApiKey(): string {
  return localStorage.getItem('agentboard_api_key') || '';
}

export function clearApiKey() {
  localStorage.removeItem('agentboard_api_key');
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

// Projects
export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => apiFetch<Project>(`/projects/${id}`),
    enabled: !!id,
  });
}

export async function createProject(data: { name: string; description?: string }): Promise<CreateProjectResponse> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// Items
export function useItems(filters?: { status?: string; sprintTag?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.sprintTag) params.set('sprintTag', filters.sprintTag);
  const qs = params.toString();
  return useQuery({
    queryKey: ['items', qs],
    queryFn: () => apiFetch<Item[]>(`/items${qs ? `?${qs}` : ''}`),
    enabled: !!getApiKey(),
    retry: false,
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: ['item', id],
    queryFn: () => apiFetch<Item>(`/items/${id}`),
    enabled: !!id,
  });
}

export function useItemContext(id: string) {
  return useQuery({
    queryKey: ['itemContext', id],
    queryFn: () => apiFetch<ItemContext>(`/items/${id}/context`),
    enabled: !!id,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; priority?: string; sprintTag?: string }) =>
      apiFetch<Item>('/items', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; description?: string; priority?: string; sprintTag?: string; assignedTo?: string }) =>
      apiFetch<Item>(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & TransitionRequest) =>
      apiFetch<Item>(`/items/${id}/transition`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['item'] });
    },
  });
}

// Decision Logs
export function useDecisionLogs(itemId: string) {
  return useQuery({
    queryKey: ['decisionLogs', itemId],
    queryFn: () => apiFetch<DecisionLog[]>(`/items/${itemId}/decision-logs`),
    enabled: !!itemId,
  });
}

export function useAddDecisionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...data }: { itemId: string; context: string; decision: string; alternatives?: string; consequences?: string }) =>
      apiFetch<DecisionLog>(`/items/${itemId}/decision-logs`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['decisionLogs', vars.itemId] }),
  });
}

// Comments
export function useComments(itemId: string) {
  return useQuery({
    queryKey: ['comments', itemId],
    queryFn: () => apiFetch<Comment[]>(`/items/${itemId}/comments`),
    enabled: !!itemId,
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, content }: { itemId: string; content: string }) =>
      apiFetch<Comment>(`/items/${itemId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['comments', vars.itemId] }),
  });
}

// Dependencies
export function useAddDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, dependsOnItemId }: { itemId: string; dependsOnItemId: string }) =>
      apiFetch(`/items/${itemId}/dependencies`, { method: 'POST', body: JSON.stringify({ dependsOnItemId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}

// Auth info
export function useAuthInfo() {
  return useQuery({
    queryKey: ['authInfo'],
    queryFn: async () => {
      const key = getApiKey();
      if (!key) return null;
      try {
        const items = await apiFetch<Item[]>('/items');
        return { authenticated: true };
      } catch {
        return null;
      }
    },
  });
}

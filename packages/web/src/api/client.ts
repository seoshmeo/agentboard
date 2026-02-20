import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Item, Project, DecisionLog, Comment, ItemContext, CreateProjectResponse, TransitionRequest, Role } from '@agentboard/shared';

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

// Multi-project support: store known project keys
export function getSavedProjects(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('agentboard_projects') || '{}');
  } catch { return {}; }
}

export function saveProjectKey(projectId: string, key: string) {
  const projects = getSavedProjects();
  projects[projectId] = key;
  localStorage.setItem('agentboard_projects', JSON.stringify(projects));
}

export function removeProjectKey(projectId: string) {
  const projects = getSavedProjects();
  delete projects[projectId];
  localStorage.setItem('agentboard_projects', JSON.stringify(projects));
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
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Server error (${res.status}). Is the backend running on port 3000?`);
  }
  return res.json();
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; anthropicApiKey?: string; telegramBotToken?: string; telegramChatId?: string }) =>
      apiFetch<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['project', vars.id] }),
  });
}

export function useProjectApiKeys(projectId: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ['projectApiKeys', projectId],
    queryFn: () => apiFetch<import('@agentboard/shared').ApiKey[]>(`/projects/${projectId}/api-keys`),
    enabled: !!projectId && enabled,
  });
}

export function useAllProjects() {
  return useQuery({
    queryKey: ['allProjects'],
    queryFn: () => apiFetch<{ id: string; name: string; createdAt: string | null }[]>('/projects'),
    staleTime: 30000,
  });
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

// Chat
export function useChatMessages(itemId: string) {
  return useQuery({
    queryKey: ['chat', itemId],
    queryFn: () => apiFetch<import('@agentboard/shared').ChatMessage[]>(`/items/${itemId}/chat`),
    enabled: !!itemId,
  });
}

export function useSendChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, content }: { itemId: string; content: string }) =>
      apiFetch<{ userMessage: import('@agentboard/shared').ChatMessage; assistantMessage: import('@agentboard/shared').ChatMessage }>(
        `/items/${itemId}/chat`, { method: 'POST', body: JSON.stringify({ content }) }
      ),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['chat', vars.itemId] }),
  });
}

// Activity
export function useActivityFeed(limit: number = 50) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: () => apiFetch<import('@agentboard/shared').ActivityEntry[]>(`/activity?limit=${limit}`),
    enabled: !!getApiKey(),
  });
}

// Auth info
export function useAuthMe() {
  return useQuery({
    queryKey: ['authMe'],
    queryFn: () => apiFetch<{ role: Role; projectId: string }>('/auth/me'),
    enabled: !!getApiKey(),
    retry: false,
  });
}

// Dependencies removal
export function useRemoveDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, dependsOnItemId }: { itemId: string; dependsOnItemId: string }) =>
      apiFetch(`/items/${itemId}/dependencies/${dependsOnItemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['itemContext'] });
    },
  });
}

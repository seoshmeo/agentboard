export type ItemStatus = 'draft' | 'pending_review' | 'approved' | 'in_progress' | 'done' | 'accepted';
export type Role = 'pm' | 'dev' | 'human';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ApiKey {
  id: string;
  projectId: string;
  role: Role;
  key: string;
  name?: string | null;
  createdAt?: string | null;
}

export interface Item {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  priority: Priority;
  status: ItemStatus;
  sprintTag?: string | null;
  assignedTo?: string | null;
  createdByRole?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Dependency {
  itemId: string;
  dependsOnItemId: string;
}

export interface DecisionLog {
  id: string;
  itemId: string;
  context: string;
  decision: string;
  alternatives?: string | null;
  consequences?: string | null;
  createdByRole?: string | null;
  createdAt?: string | null;
}

export interface Comment {
  id: string;
  itemId: string;
  content: string;
  authorRole?: string | null;
  createdAt?: string | null;
}

export interface TransitionRequest {
  to: ItemStatus;
  comment?: string;
  force?: boolean;
}

export interface ItemContext {
  item: Item;
  dependencies: {
    item: Pick<Item, 'id' | 'title' | 'status'>;
    decisionLogs: DecisionLog[];
  }[];
  comments: Comment[];
  decisionLogs: DecisionLog[];
}

export interface CreateProjectResponse {
  project: Project;
  apiKeys: ApiKey[];
}

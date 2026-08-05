export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ProjectStatus = 'active' | 'archived' | 'completed'

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: {
    requestId?: string
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

export interface ApiErrorBody {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface NotificationPreferences {
  emailTasks: boolean
  emailMentions: boolean
  emailInvites: boolean
  inAppTasks: boolean
  inAppMentions: boolean
  inAppInvites: boolean
  mentionsOnly: boolean
  digestFrequency: 'off' | 'daily' | 'weekly'
  mutedChannelIds: string[]
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailTasks: true,
  emailMentions: true,
  emailInvites: true,
  inAppTasks: true,
  inAppMentions: true,
  inAppInvites: true,
  mentionsOnly: false,
  digestFrequency: 'off',
  mutedChannelIds: [],
}

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  emailVerifiedAt?: string | null
  status: string
  notificationPreferences?: Partial<NotificationPreferences>
  createdAt?: string
}

export interface AuthTokens {
  user: User
  accessToken: string
  refreshToken: string
}

export interface OrganizationSettings {
  allowGuestInvites: boolean
  defaultRoleSlug: string
}

export interface OrganizationOnboarding {
  profileCompleted: boolean
  invitedMembers: boolean
  createdProject: boolean
  tourCompleted: boolean
  completedAt?: string | null
}

export type CompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+'

export interface Organization {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  plan: string
  ownerId: string
  companySize?: CompanySize | null
  industry?: string | null
  country?: string | null
  website?: string | null
  timezone?: string
  locale?: string
  accentColor?: string | null
  settings: OrganizationSettings
  onboarding?: OrganizationOnboarding
  createdAt?: string
  updatedAt?: string
}

export interface OrgMembershipSummary {
  organization: Organization
  membershipId: string
  roleId: string
  roleSlug: string
  roleName: string
  permissions: string[]
  status: string
}

export interface Membership {
  id: string
  organizationId: string
  userId: string | User
  roleId: string | { id: string; name: string; slug: string }
  status: 'active' | 'suspended'
  createdAt?: string
}

export interface Invitation {
  id: string
  email: string
  roleSlug?: string
  inviteeName?: string | null
  department?: string | null
  status: string
  expiresAt?: string
  createdAt?: string
}

export interface Role {
  id: string
  name: string
  slug: string
  permissions: string[]
  isSystem?: boolean
}

export interface Project {
  id: string
  organizationId: string
  name: string
  key: string
  description?: string
  status: ProjectStatus
  leadId?: string | null
  memberIds: string[]
  teamId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Team {
  id: string
  organizationId: string
  name: string
  description?: string
  leadId?: string | null
  memberIds: string[]
  createdAt?: string
  updatedAt?: string
}

export interface Meeting {
  id: string
  organizationId: string
  title: string
  startsAt: string
  endsAt: string
  participantIds: string[]
  agenda?: string
  notes?: string
  projectId?: string | null
  joinUrl?: string | null
  roomId?: string | null
  aiSummary?: string | null
  actionItemIds?: string[]
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface MessagePinEntry {
  id: string
  channelId: string
  messageId: string
  pinnedAt?: string
  body?: string
  authorName?: string
  createdAt?: string
  message?: Message | null
}

export interface MessageBookmarkEntry {
  id: string
  messageId: string
  channelId: string
  channelLabel?: string
  body: string
  authorName?: string
  messageCreatedAt?: string
  savedAt?: string
}

export interface ChannelUnreadSummary {
  counts: Record<string, number>
}

export interface DocumentComment {
  id: string
  documentId: string
  body: string
  authorId?: string | User
  mentionIds?: string[]
  parentCommentId?: string | null
  createdAt?: string
  updatedAt?: string
}

export type TemplateKind = 'project' | 'task' | 'document' | 'meeting'

export interface WorkspaceTemplate {
  id: string
  organizationId: string
  kind: TemplateKind
  name: string
  description?: string
  payload?: Record<string, unknown>
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

export type IntegrationProvider =
  | 'slack'
  | 'github'
  | 'gitlab'
  | 'jira'
  | 'linear'
  | 'google_calendar'
  | 'notion'
  | 'zapier'
  | 'webhook'

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending'

export interface IntegrationCatalogItem {
  provider: IntegrationProvider
  name: string
  description: string
  category: string
}

export interface IntegrationConnection {
  id: string
  organizationId: string
  provider: IntegrationProvider
  status: IntegrationStatus
  displayName?: string
  config?: Record<string, unknown>
  connectedBy?: string | null
  lastSyncedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SearchResults {
  projects: Array<{ id: string; name: string; key?: string; status?: string }>
  tasks: Array<{ id: string; title: string; status?: string; priority?: string; number?: number; projectId?: string }>
  documents: Array<{ id: string; title: string; updatedAt?: string }>
  channels: Array<{ id: string; name: string; type?: string; slug?: string }>
  meetings: Array<{ id: string; title: string; startsAt?: string; endsAt?: string }>
  files: Array<{ id: string; fileName: string; mimeType?: string; secureUrl?: string; url?: string }>
  people: Array<{ id: string; name?: string; email?: string; avatarUrl?: string; membershipId?: string }>
}

export interface AuditLog {
  id: string
  organizationId: string
  actorId?: string | User | null
  action: string
  resource: string
  resourceId?: string | null
  meta?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
  createdAt?: string
}

export interface TaskCustomField {
  key: string
  label: string
  value: string
}

export interface Task {
  id: string
  organizationId: string
  projectId: string
  number: number
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigneeIds: string[]
  reporterId: string
  dueDate?: string | null
  labels: string[]
  customFields?: TaskCustomField[]
  parentTaskId?: string | null
  blockedByTaskIds?: string[]
  completedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Channel {
  id: string
  organizationId: string
  name: string
  slug?: string
  description?: string
  type: 'public' | 'private' | 'direct'
  projectId?: string | null
  memberIds?: string[]
  createdBy?: string
  createdAt?: string
}

export interface MessageAttachment {
  url: string
  fileName: string
  mimeType: string
  fileAssetId?: string
}

export interface MessageReaction {
  emoji: string
  userIds: string[]
}

export interface MessageTaskCardMeta {
  taskId: string
  projectId?: string
  projectName?: string
  number?: number | null
  title: string
  description?: string
  status?: string
  priority?: string
  assigneeIds?: string[]
  dueDate?: string | null
  customFields?: TaskCustomField[]
  event?: 'created' | 'updated' | 'status' | 'assigned'
}

export interface Message {
  id: string
  channelId: string
  organizationId: string
  authorId: string | User
  body: string
  kind?: 'text' | 'task_card'
  meta?: MessageTaskCardMeta | Record<string, unknown> | null
  parentMessageId?: string | null
  attachments?: MessageAttachment[]
  reactions?: MessageReaction[]
  replyCount?: number
  editedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface DocumentVersion {
  id: string
  organizationId: string
  documentId: string
  title: string
  content?: string
  contentJson?: Record<string, unknown> | null
  createdBy?: string | User
  createdAt?: string
}

export interface DocumentItem {
  id: string
  organizationId: string
  title: string
  content?: string
  contentJson?: Record<string, unknown> | null
  projectId?: string | null
  tags?: string[]
  authorId?: string
  lastEditedBy?: string
  createdBy?: string
  updatedBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface NotificationItem {
  id: string
  userId: string
  organizationId?: string
  type: string
  title: string
  body?: string
  data?: Record<string, unknown>
  readAt?: string | null
  createdAt?: string
}

export interface FileAsset {
  id: string
  organizationId?: string
  uploadedBy?: string | User
  projectId?: string | null
  taskId?: string | null
  url: string
  secureUrl: string
  fileName: string
  mimeType: string
  bytes: number
  createdAt?: string
}

export interface AnalyticsOverview {
  members: number
  projects: number
  tasksByStatus: Record<string, number>
  openTasks: number
  dueToday: number
  overdue: number
  completedLast7Days: number
  ai: {
    requests: number
    totalTokens: number
  }
}

export interface AiGenerateResult {
  text?: string
  content?: string
  provider?: string
  model?: string
  usage?: {
    totalTokens?: number
  }
  [key: string]: unknown
}

export const KANBAN_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'in_review', label: 'In review' },
  { id: 'done', label: 'Done' },
]

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
export const PASSWORD_HINT =
  'At least 8 characters with uppercase, lowercase, and a number'

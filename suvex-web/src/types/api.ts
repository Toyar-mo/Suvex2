export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'aborted'
export type TargetKind = 'url' | 'repo' | 'path' | 'service' | 'artifact'
export type ScanGoal = 'findVulns' | 'captureFlag' | 'verifyFix'
export type SkillId = 'web' | 'api' | 'container' | 'cloud' | 'dependencies' | 'secrets' | 'protocol'
export type FindingStatus = 'new' | 'confirmed' | 'fixed' | 'closed' | 'false_positive'
export type Verification = 'none' | 'partial' | 'verified'
export type ProviderKind = 'cloud' | 'local'

export interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    details?: Record<string, string>
  }
}

export interface AuthState {
  initialized: boolean
  authenticated: boolean
}

export interface UserOut {
  id: string
  username: string
  role: string
  createdAt: string
}

export interface UserEnvelope {
  user: UserOut
}

export interface HealthOut {
  status: string
  version: string
}

export interface SandboxHealthOut {
  engine: string
  ready: boolean
  detail?: string | null
  image?: string | null
}

export interface DeepCheckOut {
  name: string
  ok: boolean
  detail?: string | null
  latencyMs?: number | null
}

/* Overview */
export interface SeverityBreakdown {
  severity: Severity
  count: number
}

export interface OverviewMetrics {
  activeScans: number
  newHighSeverityThisWeek: number
  newHighSeverityDelta: number | null
  verifiedPocCount: number
  avgScanDurationSec: number | null
  falsePositiveCount: number
  ctf2LlmCalls: number
  ctf2RecordedCalls: number
  ctf2TotalTokens: number
  ctf2UsageSince: string | null
  unresolvedBreakdown: SeverityBreakdown[]
  unresolvedTotal: number
  riskScore: number
  riskLevel: string
}

export interface ProjectedActivity {
  id: string
  scanId: string
  agentId: string
  agentPhase: string
  type: string
  summary: string
  subject: string | null
  at: string
}

export interface AttentionItem {
  kind: string
  level: string
  title: string
  detail: string
  count: number
}

export interface ResourceCount {
  kind: string
  label: string
  count: number
  detail: string
  tone: string
}

export interface OverviewOut {
  metrics: OverviewMetrics
  activity: ProjectedActivity[]
  severityBreakdown: SeverityBreakdown[]
  hasAnyScan: boolean
  attention: AttentionItem[]
  resources: ResourceCount[]
}

/* Scans */
export interface ScanOut {
  id: string
  name: string
  target: string
  targetKind: TargetKind
  status: ScanStatus
  skills: SkillId[]
  providerId: string
  brief: string | null
  goal: ScanGoal
  startedAt: string
  finishedAt: string | null
  durationSec: number | null
  agentCount: number
  findings: Partial<Record<Severity, number>>
  failureReason: string | null
  progress: number | null
  runId: string | null
  flag?: string | null
  archived?: boolean
}

export interface ScanStatsOut {
  running: number
  limit: number
  queued: number
  runner: string
  runnerReady: boolean
  runnerError: string | null
}

export interface ScanAttachmentOut {
  name: string
  sizeBytes: number
}

export interface StagedAttachmentsOut {
  stagingId: string
  files: ScanAttachmentOut[]
}

export interface HintOut {
  id: string
  text: string
  author: string | null
  consumed: boolean
  consumedTurn: number | null
  createdAt: string
}

export interface WriteupOut {
  markdown: string
  filename: string
}

export interface ScanCreatePayload {
  name?: string
  target: string
  targetKind: TargetKind
  skills: SkillId[]
  providerId: string
  brief?: string | null
  goal: ScanGoal
  attachmentStagingId?: string | null
  authorization: {
    confirmed: boolean
    statement: string
    confirmedAt: string
  }
}

/* Activity / Events */
export interface AgentOut {
  id: string
  role: string
  status: string
  target: string
  scanId: string
  eventCount: number
  lastActiveAt: string
}

export interface ActivityEventOut {
  id: string
  scanId: string
  agentId: string
  agentPhase: string
  type: string
  summary: string
  detail: Record<string, unknown> | null
  at: string
}

export interface RecentEventsOut {
  events: ActivityEventOut[]
  hasMore: boolean
}

/* Findings */
export interface FindingSummaryOut {
  id: string
  scanId: string
  severity: Severity
  category: string
  title: string
  target: string
  verification: Verification
  status: FindingStatus
  discoveredAt: string
  assigneeId: string | null
  assigneeName: string | null
  dueAt: string | null
  slaState: string
  slaDaysLeft: number | null
  deletedAt: string | null
}

export interface PocOut {
  language: string
  code: string
}

export interface FindingDetailBody {
  description: string
  affected: string[]
  reasoning: string
  evidence: string
  poc: PocOut | null
  remediation: string | null
}

export interface TimelineEntryOut {
  id: string
  at: string
  actor: string
  kind: string
  summary: string
  from_?: string | null
  to?: string | null
}

export interface FindingOut {
  id: string
  scanId: string
  severity: Severity
  category: string
  title: string
  target: string
  verification: Verification
  status: FindingStatus
  discoveredAt: string
  detail: FindingDetailBody
  timeline: TimelineEntryOut[]
}

export interface FindingStatsOut {
  total: number
  bySeverity: Partial<Record<Severity, number | null>>
  byStatus: Record<string, number>
  byCategory: Record<string, number>
  falsePositiveCount: number
}

export interface RemediationOut {
  findingId: string
  cwe: string
  category: string
  readiness: string
  title: string
  steps: string[]
  verification: string[]
  note: string
}

/* Chat */
export interface ChatSessionOut {
  id: string
  title: string
  createdBy: string
  createdAt: string
  updatedAt: string
  messageCount: number
  archived: boolean
  pinned: boolean
  running: boolean
  challengeId: string | null
  project: string | null
  persona: string | null
  providerId: string | null
  requireApproval: boolean
}

export interface ChatMessageOut {
  id: string
  seq: number
  role: 'user' | 'assistant' | 'tool' | 'system' | string
  content: string
  reasoning: string | null
  toolName: string | null
  toolArgs: Record<string, unknown> | null
  toolFailed: boolean | null
  durationMs: number | null
  createdAt: string
  surface: string
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  approvalDecidedBy: string | null
  approvalDecidedAt: string | null
}

export interface ChatChallengeRef {
  id: string
  title: string
  status: string
  score: number | null
  remoteId: string
  platformName: string
  candidateFlag: string | null
  confirmedFlag: string | null
  scanId: string | null
}

export interface ChatSessionDetailOut extends ChatSessionOut {
  messages: ChatMessageOut[]
  hasEarlier: boolean
  challenge: ChatChallengeRef | null
}

export interface ChatContextOut {
  usedTokens: number
  windowTokens: number
  percent: number
  compactionCount: number
  source: string
}

export interface ChatPersonaOut {
  id: string
  label: string
  summary: string
}

export interface ChatTodoOut {
  seq: number
  text: string
  status: string
}

export interface ChatTurnRunOut {
  id: string
  sessionId: string
  status: string
  resumeAttempts: number
  lastError: string | null
  totalTokens: number
  startedAt: string
  updatedAt: string
  resumable: boolean
  roundIndex: number
  toolsUsed: number
}

export interface ChatAttachmentOut {
  id: string
  name: string
  sizeBytes: number
}

/* CTF / Kernel */
export interface KernelAccountOut {
  id: string
  label: string
  status: string
  remoteUserId: string | null
  remoteUsername: string | null
  scopes: string[]
  tokenMask: string
  hasToken: boolean
  lastSyncedAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface KernelCompetitionOut {
  id: string
  accountId: string | null
  remoteId: string
  kind: string
  name: string
  remoteStatus: string
  startAt: string | null
  endAt: string | null
  challengeCount: number
  syncedAt: string
}

export interface KernelEnvironmentOut {
  id: string
  challengeId: string
  status: string
  sandboxProfile: string
  accessUrl: string | null
  accessUrls: string[]
  containerId: string | null
  lastError: string | null
}

export interface KernelChallengeOut {
  id: string
  competitionId: string
  remoteId: string
  stageId: string | null
  title: string
  category: string
  description: string | null
  attachments: Array<{ name?: string; url?: string; sizeBytes?: number }>
  attachmentsReady: boolean
  score: number | null
  status: string
  candidateFlag: string | null
  confirmedFlag: string | null
  remainingWrongSubmissions: number
  wrongSubmissionCount: number
  maxWrongSubmissions: intOrNum
  candidateCount: number
  sandboxProfile: string
  scanId?: string | null
  priority?: number
  environment?: KernelEnvironmentOut | null
  lastError?: string | null
}
type intOrNum = number

export interface KernelQueueOut {
  running: number
  limit: number
  queued: number
  challenges: string[]
}

export interface KernelWriteupOut {
  challengeId: string
  title: string
  category: string
  solved: boolean
  markdown: string
  filename: string
  turns: number
  elapsedSec: number | null
  updatedAt: string
}

export interface KernelUsageSummary {
  calls: number
  recordedCalls: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/* Providers & Settings */
export interface ProviderOut {
  id: string
  label: string
  model: string
  kind: ProviderKind
  apiKey: string
  hasKey: boolean
  apiKeyMask: string
  baseUrl: string
  contextWindowTokens: number | null
  isDefault: boolean
  verified: boolean
  verifyError: string | null
  note: string
}

export interface ProviderCreatePayload {
  label: string
  model: string
  kind: ProviderKind
  apiKey: string
  baseUrl: string
  contextWindowTokens?: number | null
  note?: string
  isDefault?: boolean
}

export interface ProviderVerifyResult {
  status: 'ok' | 'failed'
  durationMs: number
  endpoint: string
  reply?: string | null
  error?: string
  provider: ProviderOut
}

export interface ApiTokenOut {
  id: string
  label: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
  scopes: string[]
}

export interface SandboxOut {
  engine: string
  status: string
  image: string
  cpuLimit: number
  memoryLimitMb: number
  timeoutMinutes: number
  networkIsolated: boolean
  allowVolumeWrite: boolean
  maxConcurrentScans: number
  scanMaxTurns: number
  scanMode: string
  enableOffensivePrompt: boolean
  updatedAt: string
}

export interface SettingsSnapshotOut {
  accounts: ProviderOut[]
  sandbox: SandboxOut
  tokens: ApiTokenOut[]
}

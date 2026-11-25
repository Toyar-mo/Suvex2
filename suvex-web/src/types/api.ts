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
  agentProfileId?: string | null
  providerId: string | null
  requireApproval: boolean
  forkedFromSessionId?: string | null
  forkedFromSeq?: number | null
  branchSummary?: string | null
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

/* ==========================================================================
   Phase 2 Domain Types
   ========================================================================== */

/* Assets & Attack Surface */
export interface AssetOut {
  target: string
  scanCount: number
  lastScanAt: string | null
  lastScanStatus: string | null
  lastCompletedAt: string | null
  consecutiveFailures: number
  findingCount: number
  openFindingCount: number
  openCritical: number
  openHigh: number
  bySeverity: Record<string, number>
}

export interface AssetSummaryOut {
  targetCount: number
  findingCount: number
  openFindingCount: number
  targetsWithOpenHigh: number
  neverScanned: number
  neverCompleted: number
  generatedAt: string
}

export interface AssetListOut {
  items: AssetOut[]
  total: number
  truncated: boolean
  summary: AssetSummaryOut
}

export interface CoverageItemOut {
  factKey: string
  summary: string
  detail: string
  confidence: string
  trustLevel: string
  recordedBy: string
  updatedAt: string
  version: number
}

export interface CoverageGapOut {
  key: string
  label: string
  recorded: boolean
  matches: string[]
}

export interface CoverageOut {
  target: string
  tested: CoverageItemOut[]
  ruledOut: CoverageItemOut[]
  gaps: CoverageGapOut[]
  truncated: boolean
  stats: { tested: number; ruledOut: number }
}

/* Schedules */
export interface ScheduleOut {
  id: string
  name: string
  target: string
  targetKind: TargetKind
  goal: ScanGoal
  intervalMinutes: number
  enabled: boolean
  nextRunAt: string | null
  lastScanId: string | null
  lastRunAt: string | null
  failureCount: number
  lastFailureReason: string | null
  providerId: string
  providerLabel: string | null
  skills: SkillId[]
  brief: string | null
  createdAt: string
  updatedAt: string
}

export interface ScheduleListOut {
  items: ScheduleOut[]
  total: number
  dueCount: number
}

export interface ScheduleCreatePayload {
  name: string
  target: string
  targetKind: TargetKind
  goal: ScanGoal
  intervalMinutes: number
  providerId: string
  skills: SkillId[]
  brief?: string | null
  authorizationStatement: string
}

/* Reports */
export interface ReportOptions {
  includePoc: boolean
  includeReasoning: boolean
  onlyConfirmed: boolean
  includeRemediation: boolean
}

export interface ReportOut {
  id: string
  title: string
  scope: Record<string, unknown>
  options: ReportOptions
  createdAt: string
  findingCount: number
  excludedCount: number
  severityCounts: Record<string, number>
  format: 'pdf' | 'markdown'
  findingIds: string[]
  code: string
}

export interface ReportDocumentOut {
  meta: Record<string, unknown>
  verdict: string
  stats: Record<string, unknown>
  distribution: Array<Record<string, unknown>>
  entries: Array<Record<string, unknown>>
  method: Record<string, unknown>
  severityDefinitions: Array<Record<string, unknown>>
}

/* Credentials */
export interface CredentialOut {
  id: string
  kind: string
  username: string
  target: string
  scanId: string | null
  findingId: string | null
  source: string
  notes: string
  createdAt: string
  hasSecret: boolean
}

export interface CredentialCreatePayload {
  kind: string
  username: string
  secret: string
  target: string
  source?: string
  notes?: string
}

export interface ReusePlanOut {
  score: number
  basis: string[]
  sameTarget: number
  sameHost: number
  sameScan: number
}

/* Files */
export interface ChatFileItemOut {
  sessionId: string
  sessionTitle: string
  project: string | null
  source: string
  path: string
  name: string
  sizeBytes: number
  modifiedAt: number
}

export interface ChatFileListOut {
  items: ChatFileItemOut[]
  truncated: boolean
  limit: number
}

/* Intranet Sessions */
export type IntranetKind = 'webshell' | 'reverse' | 'ssh'
export type IntranetStatus = 'alive' | 'dead' | 'unknown'

export interface IntranetSessionOut {
  id: string
  kind: IntranetKind
  host: string
  username: string
  status: IntranetStatus
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
  hasSecret: boolean
}

/* Tools, MCP, Recipes */
export interface KernelToolOut {
  name: string
  label: string
  group: string
  summary: string
  params: string
  defaultLimitation: string
  calls: number
  lastCallAt: string | null
  enabled: boolean
  core: boolean
  requiresConnection: string
  ready: boolean
  reason: string
}

export interface KernelToolsOut {
  tools: KernelToolOut[]
  groups: string[]
  disabled: string[]
  usageSampled: number
  usageTruncated: boolean
}

export interface McpServerOut {
  name: string
  type: 'stdio' | 'http'
  command: string
  args: string[]
  url: string
  notes: string
  allowedTools: string[] | null
  hasEnv: boolean
  hasHeaders: boolean
  callTimeout: number | null
}

export interface McpServerIn {
  name: string
  type: 'stdio' | 'http'
  command: string
  args: string[]
  env: Record<string, string>
  url: string
  headers: Record<string, string>
  preserveEnv: boolean
  preserveHeaders: boolean
  notes: string
  allowedTools: string[] | null
  callTimeout: number | null
}

export interface McpServerTestOut {
  ok: boolean
  reason: string
  tools: string[]
  serverName: string
  serverVersion: string
  elapsedMs: number
}

export interface McpMountCtf2Out {
  server: McpServerOut
  test: McpServerTestOut
  message: string
}

export interface KernelRemoteCompetitionOut {
  remoteId: string
  name: string
  startAt: string | null
  endAt: string | null
  status: string
  kind?: 'competition' | 'practice' | string
  challengeCount?: number | null
}

export interface KernelToolProbeOut {
  name: string
  found: boolean
  path: string
  version: string
  probedAt: string | null
}

export interface KernelRecipeOut {
  name: string
  summary: string
  group: string
  scenario: string
  command: string
  args: string[]
  defaultLimitation: string
  calls: number
  lastCallAt: string | null
  source: string
  probe: KernelToolProbeOut | null
}

export interface KernelRecipesOut {
  recipes: KernelRecipeOut[]
  groups: string[]
  total: number
}

/* Skills */
export interface KernelSkillOut {
  name: string
  category: string
  description: string
  source: 'builtin' | 'custom' | string
  fileCount: number
}

export interface KernelSkillCategoryOut {
  category: string
  skills: KernelSkillOut[]
}

export interface KernelSkillsOut {
  total: number
  categories: KernelSkillCategoryOut[]
}

export interface SkillDetailOut {
  name: string
  category: string
  description: string
  source: string
  body: string
  lineCount: number
  files: string[]
}

export interface SkillUsageOut {
  name: string
  loads: number
  lastLoadedAt: string | null
}

export interface SkillUsageListOut {
  sampledEvents: number
  truncated: boolean
  items: SkillUsageOut[]
}

/* Agents */
export interface AgentProfileOut {
  id: string
  key: string
  name: string
  description: string
  builtin: boolean
  kind: string
  enabled: boolean
  mcpServers: string[]
  skills: string[]
  tools: string[]
  createdAt: string
  updatedAt: string
}

/* Approvals */
export interface ChatApprovalOut {
  id: string
  sessionId: string
  sessionTitle: string
  toolName: string
  toolArgs: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | string
  decidedBy: string | null
  decidedAt: string | null
  createdAt: string
}

/* Incident Response */
export interface KernelWorkOrderOut {
  challengeId: string
  title: string
  markdown: string
  filename: string
  count: number
}

/* ==========================================================================
   Suvex 2.1 Upgrade Types
   ========================================================================== */

export interface SystemTelemetryOut {
  version: string
  uptimeSeconds: number
  generatedAt: string
  eventBus: {
    mode: string
    activeSubscribers: number
    totalPublished: number
    lastPublishedAt: string | null
  }
  scans: {
    active: number
    queued: number
    completed24h: number
    failed24h: number
  }
  ctf: {
    total: number
    solved: number
    solving: number
  }
  providers: {
    total: number
    verified: number
    defaultLabel: string | null
    defaultModel: string | null
  }
  sandboxes: {
    dockerAvailable: boolean
    runningTotal: number
    sandboxCount: number
    containers: Array<{ name: string; image: string; status: string; isSandbox: boolean }>
  }
  dbPool: {
    size?: number
    checkedOut?: number
    overflow?: number
  }
}

export interface QualityOut {
  scans: { total: number; completed: number; failed: number; aborted: number; avgDurationSec: number | null }
  findings: { total: number; verified: number; needsFollowUp: number; none: number; falsePositive: number; falsePositiveRate: number | null }
  challenges: { total: number; solved: number; solveRate: number | null; candidateCount: number; wrongSubmissions: number }
  coverage: { surfaces: number; targets: number }
  generatedAt: string
}

export interface TokenUsageSeriesPoint {
  date: string
  prompt: number
  completion: number
  total: number
  calls: number
}

export interface TokenUsageTrendOut {
  days: number
  series: TokenUsageSeriesPoint[]
  totals: { prompt: number; completion: number; total: number; calls: number; unreportedCalls: number }
  cacheTracked: boolean
}

export interface ChatSessionTreeNode {
  id: string
  title: string
  forkedFromSessionId: string | null
  forkedFromSeq: number | null
  branchSummary: string | null
  messageCount: number
  createdAt: string
  current: boolean
}

export interface ChatSessionTreeOut {
  rootSessionId: string
  currentSessionId: string
  nodes: ChatSessionTreeNode[]
}

export interface ChatFileOut {
  path: string
  name: string
  sizeBytes: number
  modifiedAt: number
}

export interface ChatLiveSnapshot {
  frames: Array<{ event: string; data: Record<string, unknown> }>
  next: number
  ended: boolean
}

export interface CompareOut {
  a: ScanOut
  b: ScanOut
  onlyInA: string[]
  onlyInB: string[]
  common: string[]
  verdict: string
}

export interface FindingGroupOut {
  title: string
  severity: Severity
  category: string
  instanceCount: number
  targetCount: number
  targets: string[]
  findingIds: string[]
  byStatus: Record<string, number>
}

export interface FindingAttachmentOut {
  id: string
  findingId: string
  filename: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
  uploadedBy: string | null
}

export interface VerificationContextOut {
  finding: Record<string, unknown>
  facts: Array<Record<string, unknown>>
  relatedFindings: Array<Record<string, unknown>>
  checks: Record<string, unknown>
  note: string
}

export interface SurfaceNodeOut {
  factKey: string
  category: string
  summary: string
  detail: string
  confidence: string
  trustLevel: string
  recordedBy: string
  updatedAt: string
  version: number
}

export interface SurfaceEdgeOut {
  from?: string
  from_?: string
  type: string
  to: string
}

export interface SurfaceMapOut {
  target: string
  nodes: SurfaceNodeOut[]
  edges: SurfaceEdgeOut[]
  truncated: boolean
}

export interface HoneypotScoreOut {
  score: number
  verdict: string
  matches: Array<{ id: string; category: string; confidence: number; matched: string; source: string }>
  note: string
}

export interface RaceStatusOut {
  running: boolean
  models: string[]
  challenges: Record<string, unknown>
  cost: Record<string, unknown>
  match: string
  overview: Record<string, unknown>
  noSubmit: boolean
  report: Record<string, unknown> | null
  error: string | null
}

/* Multi-Agent Mission Graph (/agent-tasks) */
export interface MissionTaskOut {
  id: string
  title: string
  objective: string
  scope: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface MissionGoalOut {
  id: string
  seq: number
  text: string
  status: string
  evidence: string
}

export interface MissionIntentOut {
  id: string
  goalId: string | null
  seq: number
  summary: string
  status: string
  priority: number
  workerSessionId: string | null
  result: string
}

export interface MissionRunOut {
  id: string
  intentId: string | null
  role: string
  sessionId: string | null
  status: string
  output: string
}

export interface MissionScanLinkOut {
  id: string
  target: string
  status: string
}

export interface MissionGraphOut {
  task: MissionTaskOut
  goals: MissionGoalOut[]
  intents: MissionIntentOut[]
  runs: MissionRunOut[]
  scans: MissionScanLinkOut[]
}

import type {
  ActivityEventOut,
  AgentOut,
  ApiErrorBody,
  ApiTokenOut,
  AuthState,
  ChatAttachmentOut,
  ChatContextOut,
  ChatMessageOut,
  ChatPersonaOut,
  ChatSessionDetailOut,
  ChatSessionOut,
  ChatTodoOut,
  ChatTurnRunOut,
  DeepCheckOut,
  FindingOut,
  FindingStatsOut,
  FindingStatus,
  FindingSummaryOut,
  HealthOut,
  HintOut,
  KernelAccountOut,
  KernelChallengeOut,
  KernelCompetitionOut,
  KernelQueueOut,
  KernelUsageSummary,
  KernelWriteupOut,
  OverviewOut,
  ProviderCreatePayload,
  ProviderOut,
  ProviderVerifyResult,
  RecentEventsOut,
  RemediationOut,
  SandboxHealthOut,
  SandboxOut,
  ScanCreatePayload,
  ScanOut,
  ScanStatsOut,
  SettingsSnapshotOut,
  StagedAttachmentsOut,
  UserEnvelope,
  UserOut,
  WriteupOut,
} from '@/types/api'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api/v1'

export class ApiClientError extends Error {
  status: number
  code: string
  details?: Record<string, string>

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type UnauthorizedListener = () => void
const unauthorizedListeners = new Set<UnauthorizedListener>()

export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

function notifyUnauthorized() {
  for (const fn of unauthorizedListeners) fn()
}

async function request<T>(
  path: string,
  init: RequestInit & { skipAuthRedirect?: boolean } = {},
): Promise<T> {
  const { skipAuthRedirect, headers, body, ...rest } = init
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const mergedHeaders = new Headers(headers)
  if (!isFormData && body !== undefined && !mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...rest,
    headers: mergedHeaders,
    body,
  })

  if (res.status === 401 && !skipAuthRedirect) {
    notifyUnauthorized()
  }

  if (res.status === 204) {
    return undefined as T
  }

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')

  if (!res.ok) {
    let code = `HTTP_${res.status}`
    let message = `请求失败（HTTP ${res.status}）`
    let details: Record<string, string> | undefined
    if (isJson) {
      try {
        const errBody = (await res.json()) as ApiErrorBody
        if (errBody.error) {
          code = errBody.error.code || code
          message = errBody.error.message || message
          details = errBody.error.details
        }
      } catch {
        // ignore parse failure
      }
    }
    throw new ApiClientError(res.status, code, message, details)
  }

  if (!isJson) {
    return (await res.text()) as T
  }
  return (await res.json()) as T
}

function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      sp.set(k, String(v))
    }
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export interface ChatStreamCallbacks {
  onPhase?: (payload: { phase: string; round?: number; tool?: string; reason?: string }) => void
  onDelta?: (text: string) => void
  onReasoning?: (text: string) => void
  onToolOutput?: (payload: { tool?: string; text?: string; chunk?: string }) => void
  onToolProgress?: (payload: { tool?: string; seconds?: number }) => void
  onMessage?: (msg: ChatMessageOut) => void
  onAwaiting?: (payload: { messageId: string }) => void
  onDone?: (payload: { messageCount?: number; awaitingApproval?: string | null }) => void
  onError?: (message: string) => void
}

export const api = {
  /* Auth */
  getAuthState: () => request<AuthState>('/auth/state', { skipAuthRedirect: true }),
  setupAdmin: (username: string, password: string) =>
    request<UserEnvelope>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuthRedirect: true,
    }),
  login: (username: string, password: string) =>
    request<UserEnvelope>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuthRedirect: true,
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST', skipAuthRedirect: true }),
  getMe: () => request<UserOut>('/auth/me', { skipAuthRedirect: true }),

  /* Health & Overview */
  getHealth: () => request<HealthOut>('/health', { skipAuthRedirect: true }),
  getSandboxHealth: () => request<SandboxHealthOut>('/health/sandbox'),
  getDeepHealth: () => request<DeepCheckOut[]>('/health/deep'),
  getOverview: (scanId?: string) => request<OverviewOut>(`/overview${qs({ scanId })}`),

  /* Scans */
  listScans: (params?: { status?: string; q?: string; sort?: string; dir?: string; archived?: boolean }) =>
    request<ScanOut[]>(`/scans${qs(params || {})}`),
  getScan: (scanId: string) => request<ScanOut>(`/scans/${encodeURIComponent(scanId)}`),
  getScanQueue: () => request<ScanStatsOut>('/scans/queue'),
  createScan: (payload: ScanCreatePayload) =>
    request<ScanOut>('/scans', { method: 'POST', body: JSON.stringify(payload) }),
  abortScan: (scanId: string) =>
    request<ScanOut>(`/scans/${encodeURIComponent(scanId)}/abort`, { method: 'POST' }),
  rerunScan: (scanId: string, authorization: ScanCreatePayload['authorization'], name?: string) =>
    request<ScanOut>(`/scans/${encodeURIComponent(scanId)}/rerun`, {
      method: 'POST',
      body: JSON.stringify({ authorization, name }),
    }),
  stageScanAttachments: (files: File[]) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    return request<StagedAttachmentsOut>('/scans/attachments/staging', {
      method: 'POST',
      body: fd,
    })
  },
  getScanAgents: (scanId: string) =>
    request<AgentOut[]>(`/scans/${encodeURIComponent(scanId)}/agents`),
  getScanHints: (scanId: string) =>
    request<HintOut[]>(`/scans/${encodeURIComponent(scanId)}/hints`),
  postScanHint: (scanId: string, text: string) =>
    request<HintOut>(`/scans/${encodeURIComponent(scanId)}/hints`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  getScanWriteup: (scanId: string) =>
    request<WriteupOut>(`/scans/${encodeURIComponent(scanId)}/writeup`),
  deleteScans: (ids: string[]) =>
    request<{ changed: number; skipped: number }>('/scans/batch/delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  /* Events / Activity */
  getRecentEvents: (scanId: string, limit = 200) =>
    request<RecentEventsOut>(`/scans/${encodeURIComponent(scanId)}/events/recent${qs({ limit })}`),
  createActivityStream: (scanId?: string | null, lastEventId?: string | null) => {
    const base = scanId
      ? `${API_BASE}/scans/${encodeURIComponent(scanId)}/events`
      : `${API_BASE}/events`
    return new EventSource(`${base}${qs({ lastEventId: lastEventId || undefined })}`, {
      withCredentials: true,
    })
  },
  parseActivityEvent: (raw: string): ActivityEventOut | null => {
    try {
      return JSON.parse(raw) as ActivityEventOut
    } catch {
      return null
    }
  },

  /* Findings */
  listFindings: (params?: {
    severity?: string
    status?: string
    category?: string
    q?: string
    scanId?: string
  }) => request<FindingSummaryOut[]>(`/findings${qs(params || {})}`),
  getFindingStats: (params?: { scanId?: string; severity?: string; status?: string; q?: string }) =>
    request<FindingStatsOut>(`/findings/stats${qs(params || {})}`),
  getFinding: (findingId: string) =>
    request<FindingOut>(`/findings/${encodeURIComponent(findingId)}`),
  updateFindingsStatus: (ids: string[], status: FindingStatus, note?: string) =>
    request<{ changed: number; skipped: number; findings: FindingSummaryOut[] }>(
      '/findings/status',
      {
        method: 'POST',
        body: JSON.stringify({ ids, status, note }),
      },
    ),
  getFindingRemediation: (findingId: string) =>
    request<RemediationOut>(`/findings/${encodeURIComponent(findingId)}/remediation`),
  getFindingsExportUrl: (format: 'json' | 'sarif', params?: { scanId?: string; severity?: string; status?: string }) =>
    `${API_BASE}/findings/export${format === 'sarif' ? '/sarif' : ''}${qs(params || {})}`,

  /* Chat */
  listChatSessions: (includeArchived = false) =>
    request<ChatSessionOut[]>(`/chat/sessions${qs({ includeArchived })}`),
  createChatSession: (payload?: { title?: string; project?: string; persona?: string }) =>
    request<ChatSessionOut>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  createChatForChallenge: (challengeId: string) =>
    request<ChatSessionOut>(`/chat/sessions/for-challenge/${encodeURIComponent(challengeId)}`, {
      method: 'POST',
    }),
  getChatSession: (sessionId: string, limit = 120) =>
    request<ChatSessionDetailOut>(`/chat/sessions/${encodeURIComponent(sessionId)}${qs({ limit })}`),
  renameChatSession: (sessionId: string, title: string) =>
    request<ChatSessionOut>(`/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  pinChatSession: (sessionId: string, pinned: boolean) =>
    request<ChatSessionOut>(`/chat/sessions/${encodeURIComponent(sessionId)}/pin`, {
      method: 'POST',
      body: JSON.stringify({ pinned }),
    }),
  archiveChatSession: (sessionId: string) =>
    request<void>(`/chat/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  unarchiveChatSession: (sessionId: string) =>
    request<ChatSessionOut>(`/chat/sessions/${encodeURIComponent(sessionId)}/unarchive`, {
      method: 'POST',
    }),
  getChatContext: (sessionId: string) =>
    request<ChatContextOut>(`/chat/sessions/${encodeURIComponent(sessionId)}/context`),
  compactChatSession: (sessionId: string) =>
    request<{ summary: string }>(`/chat/sessions/${encodeURIComponent(sessionId)}/compact`, {
      method: 'POST',
    }),
  getChatTodos: (sessionId: string) =>
    request<ChatTodoOut[]>(`/chat/sessions/${encodeURIComponent(sessionId)}/todos`),
  getChatTurns: (sessionId: string) =>
    request<ChatTurnRunOut[]>(`/chat/sessions/${encodeURIComponent(sessionId)}/turns`),
  listChatPersonas: () => request<ChatPersonaOut[]>('/chat/personas'),
  updateChatSettings: (
    sessionId: string,
    payload: { providerId?: string | null; persona?: string | null; requireApproval?: boolean },
  ) =>
    request<ChatSessionOut>(`/chat/sessions/${encodeURIComponent(sessionId)}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  uploadChatAttachment: (sessionId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return request<ChatAttachmentOut>(`/chat/sessions/${encodeURIComponent(sessionId)}/attachments`, {
      method: 'POST',
      body: fd,
    })
  },
  interjectChat: (sessionId: string, content: string) =>
    request<ChatMessageOut>(`/chat/sessions/${encodeURIComponent(sessionId)}/interject`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  interruptChat: (sessionId: string, mode: 'continue' | 'stop', note = '') =>
    request<void>(`/chat/sessions/${encodeURIComponent(sessionId)}/interrupt`, {
      method: 'POST',
      body: JSON.stringify({ mode, note }),
    }),
  approveChatTool: (sessionId: string, messageId: string, approve: boolean) =>
    request<{ messages: ChatMessageOut[]; awaitingApproval: string | null }>(
      `/chat/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/approval`,
      {
        method: 'POST',
        body: JSON.stringify({ approve }),
      },
    ),
  resumeChatTurn: (sessionId: string, runId: string) =>
    request<{ messages: ChatMessageOut[]; awaitingApproval: string | null }>(
      `/chat/sessions/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(runId)}/resume`,
      { method: 'POST' },
    ),
  streamChatMessage: async (
    sessionId: string,
    payload: { content: string; providerId?: string | null; attachmentIds?: string[] },
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal,
  ) => {
    const res = await fetch(`${API_BASE}/chat/sessions/${encodeURIComponent(sessionId)}/messages/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })

    if (res.status === 401) {
      notifyUnauthorized()
    }
    if (!res.ok) {
      let msg = `发送失败（HTTP ${res.status}）`
      let code = `HTTP_${res.status}`
      try {
        const body = (await res.json()) as ApiErrorBody
        if (body.error?.message) msg = body.error.message
        if (body.error?.code) code = body.error.code
      } catch {
        // ignore
      }
      throw new ApiClientError(res.status, code, msg)
    }

    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let eventName = 'message'
    let dataLines: string[] = []

    const flushEvent = () => {
      if (dataLines.length === 0) return
      const raw = dataLines.join('\n')
      const evt = eventName
      eventName = 'message'
      dataLines = []

      let parsed: Record<string, unknown> | null = null
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>
      } catch {
        return
      }

      if (evt === 'phase') {
        callbacks.onPhase?.(parsed as { phase: string; round?: number; tool?: string; reason?: string })
      } else if (evt === 'delta') {
        if (typeof parsed.text === 'string') callbacks.onDelta?.(parsed.text)
      } else if (evt === 'reasoning') {
        if (typeof parsed.text === 'string') callbacks.onReasoning?.(parsed.text)
      } else if (evt === 'tool_output') {
        callbacks.onToolOutput?.(parsed as { tool?: string; text?: string; chunk?: string })
      } else if (evt === 'tool_progress') {
        callbacks.onToolProgress?.(parsed as { tool?: string; seconds?: number })
      } else if (evt === 'message') {
        callbacks.onMessage?.(parsed as unknown as ChatMessageOut)
      } else if (evt === 'awaiting') {
        callbacks.onAwaiting?.(parsed as { messageId: string })
      } else if (evt === 'done') {
        callbacks.onDone?.(parsed as { messageCount?: number; awaitingApproval?: string | null })
      } else if (evt === 'error') {
        callbacks.onError?.(typeof parsed.message === 'string' ? parsed.message : '本轮对话失败')
      }
    }

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line === '') {
          flushEvent()
        } else if (line.startsWith(':')) {
          continue
        } else if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart())
        }
      }
    }
    flushEvent()
  },

  /* CTF / Kernel */
  getKernelAccounts: () => request<KernelAccountOut[]>('/kernel/accounts'),
  bindKernelAccount: (token: string, label: string) =>
    request<KernelAccountOut>('/kernel/accounts', {
      method: 'POST',
      body: JSON.stringify({ token, label }),
    }),
  deleteKernelAccount: (accountId: string) =>
    request<void>(`/kernel/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' }),
  getKernelCompetitions: () => request<KernelCompetitionOut[]>('/kernel/competitions'),
  getKernelChallenges: (params?: { competitionId?: string; status?: string }) =>
    request<KernelChallengeOut[]>(`/kernel/challenges${qs(params || {})}`),
  getKernelQueue: () => request<KernelQueueOut>('/kernel/queue'),
  syncKernel: (competitionIds: string[] = []) =>
    request<{ competitions: number; challengesCreated: number; challengesUpdated: number; message: string }>(
      '/kernel/sync',
      {
        method: 'POST',
        body: JSON.stringify({ competitionIds }),
      },
    ),
  pullChallenge: (input: string) =>
    request<{ challenge: KernelChallengeOut; created: boolean; competitionName: string }>(
      '/kernel/challenges/pull',
      {
        method: 'POST',
        body: JSON.stringify({ input }),
      },
    ),
  solveChallenge: (challengeId: string, opts?: { brief?: string; resume?: boolean }) =>
    request<{ challenge: KernelChallengeOut; message: string }>(
      `/kernel/challenges/${encodeURIComponent(challengeId)}/solve`,
      {
        method: 'POST',
        body: JSON.stringify({ brief: opts?.brief || null, resume: Boolean(opts?.resume) }),
      },
    ),
  cancelChallenge: (challengeId: string) =>
    request<KernelChallengeOut>(`/kernel/challenges/${encodeURIComponent(challengeId)}/cancel`, {
      method: 'POST',
    }),
  submitFlag: (challengeId: string, flag: string) =>
    request<{ status: string; message: string; challenge: KernelChallengeOut }>(
      `/kernel/challenges/${encodeURIComponent(challengeId)}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({ flag }),
      },
    ),
  getChallengeWriteup: (challengeId: string) =>
    request<KernelWriteupOut>(`/kernel/challenges/${encodeURIComponent(challengeId)}/writeup`),
  getKernelUsage: (competitionId?: string) =>
    request<KernelUsageSummary>(`/kernel/usage${qs({ competitionId })}`),

  /* Providers & Settings */
  listProviders: () => request<ProviderOut[]>('/providers'),
  createProvider: (payload: ProviderCreatePayload) =>
    request<{ status: string; provider: ProviderOut }>('/providers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProvider: (providerId: string, payload: Partial<ProviderCreatePayload>) =>
    request<{ status: string; provider: ProviderOut }>(
      `/providers/${encodeURIComponent(providerId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),
  deleteProvider: (providerId: string) =>
    request<void>(`/providers/${encodeURIComponent(providerId)}`, { method: 'DELETE' }),
  verifyProvider: (providerId: string) =>
    request<ProviderVerifyResult>(`/providers/${encodeURIComponent(providerId)}/verify`, {
      method: 'POST',
    }),
  setDefaultProvider: (providerId: string) =>
    request<{ status: string; provider: ProviderOut }>(
      `/providers/${encodeURIComponent(providerId)}/default`,
      { method: 'POST' },
    ),
  getSettingsSnapshot: () => request<SettingsSnapshotOut>('/settings'),
  updateSandbox: (payload: Omit<SandboxOut, 'engine' | 'status' | 'updatedAt'>) =>
    request<SandboxOut>('/settings/sandbox', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  createApiToken: (label: string, scopes: string[]) =>
    request<{ token: ApiTokenOut; plaintext: string }>('/settings/tokens', {
      method: 'POST',
      body: JSON.stringify({ label, scopes }),
    }),
  deleteApiToken: (tokenId: string) =>
    request<void>(`/settings/tokens/${encodeURIComponent(tokenId)}`, { method: 'DELETE' }),
  changePassword: (current: string, next: string, confirm: string) =>
    request<{ ok: boolean }>('/settings/password', {
      method: 'POST',
      body: JSON.stringify({ current, next, confirm }),
    }),
}

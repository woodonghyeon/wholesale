import { createClient } from './client'

export type ActionType =
  | 'auth.login'
  | 'auth.signup'
  | 'auth.logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'adjust'
  | 'export'
  | 'error'

export type ResourceType =
  | 'slip'
  | 'product'
  | 'partner'
  | 'inventory'
  | 'payment'
  | 'note'
  | 'return'
  | 'quote'
  | 'customer'
  | 'cash'
  | 'tax'
  | 'stocktake'
  | 'auth'
  | 'settings'

export interface ActivityLog {
  id: string
  user_id: string | null
  action_type: ActionType
  resource_type: ResourceType | null
  resource_id: string | null
  description: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

/** 로그를 기록합니다. 오류가 나도 조용히 실패합니다. */
export async function logActivity(opts: {
  action_type: ActionType
  resource_type?: ResourceType
  resource_id?: string
  description: string
  metadata?: Record<string, unknown>
}) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activity_logs').insert({
      user_id: user?.id ?? null,
      action_type: opts.action_type,
      resource_type: opts.resource_type ?? null,
      resource_id: opts.resource_id ?? null,
      description: opts.description,
      metadata: opts.metadata ?? {},
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
  } catch {
    // 로그 실패는 조용히 처리
  }
}

export async function getActivityLogs(opts: {
  actionType?: string
  resourceType?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
} = {}): Promise<ActivityLog[]> {
  const supabase = createClient()
  let q = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 200)

  if (opts.offset) q = q.range(opts.offset, (opts.offset) + (opts.limit ?? 200) - 1)
  if (opts.actionType && opts.actionType !== 'all') q = q.eq('action_type', opts.actionType)
  if (opts.resourceType && opts.resourceType !== 'all') q = q.eq('resource_type', opts.resourceType)
  if (opts.from) q = q.gte('created_at', opts.from + 'T00:00:00')
  if (opts.to) q = q.lte('created_at', opts.to + 'T23:59:59')

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ActivityLog[]
}

export async function getAuthLogs(): Promise<ActivityLog[]> {
  return getActivityLogs({ actionType: 'auth.login', limit: 200 })
}

export function subscribeToLogs(onInsert: (log: ActivityLog) => void) {
  const supabase = createClient()
  const channel = supabase
    .channel('activity_logs_realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_logs' },
      (payload) => onInsert(payload.new as ActivityLog)
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

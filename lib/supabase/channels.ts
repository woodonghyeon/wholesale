import { createClient } from './client'
import { Channel } from '@/lib/types'
import { logActivity } from './logs'

export async function getChannels(): Promise<Channel[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .order('sort_order')
  if (error) throw new Error('채널 목록 조회 실패: ' + error.message)
  return data ?? []
}

export async function upsertChannel(channel: Partial<Channel> & { name: string }): Promise<Channel> {
  const supabase = createClient()
  const isNew = !channel.id
  const { data, error } = await supabase.from('channels').upsert(channel).select().single()
  if (error) throw new Error('채널 저장 실패: ' + error.message)
  logActivity({ action_type: isNew ? 'create' : 'update', resource_type: 'settings', resource_id: data.id, description: `판매채널 ${isNew ? '등록' : '수정'}: ${channel.name}`, metadata: { name: channel.name, commission_rate: channel.commission_rate } })
  return data
}

export async function deleteChannel(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('channels').delete().eq('id', id)
  if (error) throw new Error('채널 삭제 실패: ' + error.message)
  logActivity({ action_type: 'delete', resource_type: 'settings', resource_id: id, description: `판매채널 삭제: ${id.slice(0, 8)}` })
}

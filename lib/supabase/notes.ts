import { createClient } from './client'
import { Note, NoteType, NoteStatus } from '../types'
import { logActivity } from './logs'

export type NoteRow = Note & { partner_name?: string }

export async function getNotes(businessId?: string, noteType?: NoteType) {
  const supabase = createClient()
  let q = supabase.from('notes').select('*, partners(name)').order('due_date', { ascending: true })
  if (businessId) q = q.eq('business_id', businessId)
  if (noteType) q = q.eq('note_type', noteType)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({ ...r, partner_name: r.partners?.name ?? null })) as NoteRow[]
}

export async function upsertNote(note: Partial<Note>) {
  const supabase = createClient()
  const isNew = !note.id
  const { error } = await supabase.from('notes').upsert(note)
  if (error) throw new Error(error.message)
  logActivity({ action_type: isNew ? 'create' : 'update', resource_type: 'note', resource_id: note.id ?? '', description: `어음 ${isNew ? '등록' : '수정'}: ${note.note_type === 'receivable' ? '받을어음' : '지급어음'} ${(note.amount ?? 0).toLocaleString()}원`, metadata: { note_type: note.note_type, amount: note.amount, due_date: note.due_date } })
}

export async function updateNoteStatus(id: string, status: NoteStatus) {
  const supabase = createClient()
  const { error } = await supabase.from('notes').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
  logActivity({ action_type: 'update', resource_type: 'note', resource_id: id, description: `어음 상태 변경: ${status === 'cleared' ? '결제완료' : status === 'bounced' ? '부도' : '대기'}` })
}

export async function deleteNote(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw new Error(error.message)
  logActivity({ action_type: 'delete', resource_type: 'note', resource_id: id, description: `어음 삭제: ${id.slice(0, 8)}` })
}

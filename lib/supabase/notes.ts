import { createClient } from './client'
import { Note, NoteType, NoteStatus } from '../types'

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
  const { error } = await supabase.from('notes').upsert(note)
  if (error) throw new Error(error.message)
}

export async function updateNoteStatus(id: string, status: NoteStatus) {
  const supabase = createClient()
  const { error } = await supabase.from('notes').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteNote(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

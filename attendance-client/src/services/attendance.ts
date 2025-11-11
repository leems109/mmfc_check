import { supabase } from '../lib/supabaseClient'

export type CheckInPayload = {
  userName: string
}

export type CheckInRecord = {
  name: string
  created_at: string
}

export type AllowedUser = {
  name: string
}

export async function fetchAllowedUsers(): Promise<AllowedUser[]> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { data, error } = await supabase.from('mmfc_allowed').select('name').order('name')

  if (error) {
    throw new Error(error.message ?? '허용된 사용자 목록을 불러오는 중 오류가 발생했습니다.')
  }

  return data ?? []
}

export async function checkIn({ userName }: CheckInPayload) {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { error } = await supabase.from('mmfc_check').insert({
    name: userName,
  })

  if (error) {
    throw new Error(error.message ?? 'Supabase 삽입 중 오류가 발생했습니다.')
  }
}

export async function fetchTodayCheckIns(): Promise<CheckInRecord[]> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('mmfc_check')
    .select('name, created_at')
    .gte('created_at', startOfToday.toISOString())
    .order('name', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message ?? 'Supabase 조회 중 오류가 발생했습니다.')
  }

  return data ?? []
}


import { supabase } from '../lib/supabaseClient'

export type CheckInPayload = {
  userName: string
}

export type CheckInRecord = {
  name: string
  created_at: string
}

export type FormationAssignment = {
  slot_id: string
  player_name: string | null
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
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

  const { data, error } = await supabase
    .from('mmfc_check')
    .select('name, created_at')
    .gte('created_at', startOfToday.toISOString())
    .lt('created_at', startOfTomorrow.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message ?? 'Supabase 조회 중 오류가 발생했습니다.')
  }

  return data ?? []
}

export async function fetchGateState(): Promise<boolean> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('mmfc_admin_gate')
    .select('is_active')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message ?? '출석 허용 상태를 불러오는 중 오류가 발생했습니다.')
  }

  return data?.is_active ?? false
}

export async function updateGateState(isActive: boolean): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { error } = await supabase
    .from('mmfc_admin_gate')
    .upsert({ id: 1, is_active: isActive }, { onConflict: 'id' })

  if (error) {
    throw new Error(error.message ?? '출석 허용 상태를 저장하는 중 오류가 발생했습니다.')
  }
}

export async function fetchFormationAssignments(): Promise<FormationAssignment[]> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('mmfc_formation')
    .select('slot_id, player_name')

  if (error) {
    throw new Error(error.message ?? '포메이션 정보를 불러오는 중 오류가 발생했습니다.')
  }

  return data ?? []
}

export async function upsertFormationAssignment(
  slotId: string,
  playerName: string | null,
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  if (!playerName) {
    const { error } = await supabase.from('mmfc_formation').delete().eq('slot_id', slotId)
    if (error) {
      throw new Error(error.message ?? '포지션에서 선수를 제거하는 중 오류가 발생했습니다.')
    }
    return
  }

  const { error } = await supabase
    .from('mmfc_formation')
    .upsert({ slot_id: slotId, player_name: playerName }, { onConflict: 'slot_id' })

  if (error) {
    throw new Error(error.message ?? '포지션에 선수를 배치하는 중 오류가 발생했습니다.')
  }
}

export async function resetFormationAssignments(): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { error } = await supabase.from('mmfc_formation').delete().neq('slot_id', '')

  if (error) {
    throw new Error(error.message ?? '포메이션을 초기화하는 중 오류가 발생했습니다.')
  }
}

export async function fetchAttendanceByYear(year: number): Promise<CheckInRecord[]> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const startOfYear = new Date(Date.UTC(year, 0, 1))
  const startOfNextYear = new Date(Date.UTC(year + 1, 0, 1))

  const { data, error } = await supabase
    .from('mmfc_check')
    .select('name, created_at')
    .gte('created_at', startOfYear.toISOString())
    .lt('created_at', startOfNextYear.toISOString())

  if (error) {
    throw new Error(error.message ?? '연도별 출석 정보를 불러오는 중 오류가 발생했습니다.')
  }

  return data ?? []
}


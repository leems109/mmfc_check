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
  day_key: string
  quarter: number
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

export async function fetchTodayCheckIns(date?: string): Promise<CheckInRecord[]> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const baseDate = date ? new Date(date) : new Date()
  const startOfDay = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()),
  )
  const startOfNextDay = new Date(startOfDay)
  startOfNextDay.setUTCDate(startOfNextDay.getUTCDate() + 1)

  const { data, error } = await supabase
    .from('mmfc_check')
    .select('name, created_at')
    .gte('created_at', startOfDay.toISOString())
    .lt('created_at', startOfNextDay.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message ?? 'Supabase 조회 중 오류가 발생했습니다.')
  }

  return (data ?? []) as CheckInRecord[]
}

export async function deleteCheckIn(name: string, dayKey: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  if (!/^\d{8}$/.test(dayKey)) {
    throw new Error('삭제할 날짜 형식이 올바르지 않습니다. (예: 20251111)')
  }

  const year = Number(dayKey.slice(0, 4))
  const month = Number(dayKey.slice(4, 6)) - 1
  const day = Number(dayKey.slice(6, 8))

  const localStart = new Date(year, month, day, 0, 0, 0)
  const startOfDay = new Date(localStart.getTime() - localStart.getTimezoneOffset() * 60000)
  const startOfNextDay = new Date(startOfDay)
  startOfNextDay.setUTCDate(startOfNextDay.getUTCDate() + 1)

  console.log('[deleteCheckIn] range', {
    name,
    dayKey,
    start: startOfDay.toISOString(),
    end: startOfNextDay.toISOString(),
  })

  const { data, error } = await supabase
    .from('mmfc_check')
    .select('created_at')
    .eq('name', name)
    .gte('created_at', startOfDay.toISOString())
    .lt('created_at', startOfNextDay.toISOString())
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message ?? '삭제할 출석 기록을 조회하는 중 오류가 발생했습니다.')
  }

  if (!data) {
    throw new Error('해당 날짜에 일치하는 출석 기록이 없습니다.')
  }

  console.log('[deleteCheckIn] deleting', { name, created_at: data.created_at })

  const { error: deleteError } = await supabase
    .from('mmfc_check')
    .delete()
    .eq('name', name)
    .eq('created_at', data.created_at)

  if (deleteError) {
    throw new Error(deleteError.message ?? '출석 정보를 삭제하는 중 오류가 발생했습니다.')
  }
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

export async function fetchFormationAssignments(
  dayKey: string,
  quarter: number,
): Promise<FormationAssignment[]> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('mmfc_formation')
    .select('slot_id, player_name, day_key, quarter')
    .eq('day_key', dayKey)
    .eq('quarter', quarter)

  if (error) {
    throw new Error(error.message ?? '포메이션 정보를 불러오는 중 오류가 발생했습니다.')
  }

  return data ?? []
}

export async function upsertFormationAssignment(
  slotId: string,
  playerName: string | null,
  dayKey: string,
  quarter: number,
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  if (!playerName) {
    const { error } = await supabase
      .from('mmfc_formation')
      .delete()
      .eq('slot_id', slotId)
      .eq('day_key', dayKey)
      .eq('quarter', quarter)

    if (error) {
      throw new Error(error.message ?? '포지션에서 선수를 제거하는 중 오류가 발생했습니다.')
    }
    return
  }

  const { error } = await supabase
    .from('mmfc_formation')
    .upsert(
      { slot_id: slotId, player_name: playerName, day_key: dayKey, quarter },
      { onConflict: 'slot_id,day_key,quarter' },
    )

  if (error) {
    throw new Error(error.message ?? '포지션에 선수를 배치하는 중 오류가 발생했습니다.')
  }
}

export async function resetFormationAssignments(dayKey: string, quarter: number): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { error } = await supabase
    .from('mmfc_formation')
    .delete()
    .eq('day_key', dayKey)
    .eq('quarter', quarter)

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

  return (data ?? []) as CheckInRecord[]
}

export async function fetchFormationAssignmentsByDay(
  dayKey: string,
): Promise<FormationAssignment[]> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('mmfc_formation')
    .select('slot_id, player_name, day_key, quarter')
    .eq('day_key', dayKey)

  if (error) {
    throw new Error(error.message ?? '포메이션 정보를 불러오는 중 오류가 발생했습니다.')
  }

  return data ?? []
}

export async function fetchFormationType(
  dayKey: string,
  quarter: number,
): Promise<string | null> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('mmfc_formation_type')
    .select('formation_type')
    .eq('day_key', dayKey)
    .eq('quarter', quarter)
    .maybeSingle()

  if (error) {
    throw new Error(error.message ?? '포메이션 타입을 불러오는 중 오류가 발생했습니다.')
  }

  return data?.formation_type ?? null
}

export async function upsertFormationType(
  dayKey: string,
  quarter: number,
  formationType: string,
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
  }

  const { error } = await supabase
    .from('mmfc_formation_type')
    .upsert(
      { day_key: dayKey, quarter, formation_type: formationType },
      { onConflict: 'day_key,quarter' },
    )

  if (error) {
    throw new Error(error.message ?? '포메이션 타입을 저장하는 중 오류가 발생했습니다.')
  }
}


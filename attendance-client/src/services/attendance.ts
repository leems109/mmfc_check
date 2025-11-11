import { supabase } from '../lib/supabaseClient'

export type CheckInPayload = {
  userName: string
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


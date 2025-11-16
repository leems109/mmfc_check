import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import {
  checkIn,
  deleteCheckIn,
  fetchAttendanceByYear,
  fetchFormationAssignments,
  fetchFormationAssignmentsByDay,
  fetchFormationType,
  fetchGateState,
  fetchTodayCheckIns,
  resetFormationAssignments,
  updateGateState,
  upsertFormationAssignment,
  upsertFormationType,
  type CheckInRecord,
} from './services/attendance'

type FormationSlot = {
  id: string
  label: string
  row: number
  column: number
}

type FormationSlotState = FormationSlot & {
  player: string | null
}

type SelectedPlayer = {
  name: string
  source: 'bench' | 'slot'
  slotId?: string
}

type FormationType = '442' | '4231'

const FORMATION_TEMPLATES: Record<FormationType, FormationSlot[]> = {
  '442': [
    { id: 'slot-st1', label: 'ST', row: 1, column: 2 },
    { id: 'slot-st2', label: 'ST', row: 1, column: 4 },
    { id: 'slot-lm', label: 'LM', row: 2, column: 1 },
    { id: 'slot-lcm', label: 'CM', row: 2, column: 2 },
    { id: 'slot-rcm', label: 'CM', row: 2, column: 4 },
    { id: 'slot-rm', label: 'RM', row: 2, column: 5 },
    { id: 'slot-lb', label: 'LB', row: 3, column: 1 },
    { id: 'slot-lcb', label: 'CB', row: 3, column: 2 },
    { id: 'slot-rcb', label: 'CB', row: 3, column: 4 },
    { id: 'slot-rb', label: 'RB', row: 3, column: 5 },
    { id: 'slot-gk', label: 'GK', row: 4, column: 3 },
  ],
  '4231': [
    { id: 'slot-st', label: 'ST', row: 1, column: 3 },
    { id: 'slot-lw', label: 'LW', row: 2, column: 1 },
    { id: 'slot-cam', label: 'CAM', row: 2, column: 3 },
    { id: 'slot-rw', label: 'RW', row: 2, column: 5 },
    { id: 'slot-lcdm', label: 'CDM', row: 3, column: 2 },
    { id: 'slot-rcdm', label: 'CDM', row: 3, column: 4 },
    { id: 'slot-lb', label: 'LB', row: 4, column: 1 },
    { id: 'slot-lcb', label: 'CB', row: 4, column: 2 },
    { id: 'slot-rcb', label: 'CB', row: 4, column: 4 },
    { id: 'slot-rb', label: 'RB', row: 4, column: 5 },
    { id: 'slot-gk', label: 'GK', row: 5, column: 3 },
  ],
}

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'mmfc1234',
}

const toLocalDateString = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)

function App() {
  const [userName, setUserName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([])
  const [listError, setListError] = useState('')
  const [listLoading, setListLoading] = useState(false)
  const [isGateOpen, setIsGateOpen] = useState(false)
  const [gateLoading, setGateLoading] = useState(false)
  const [gateError, setGateError] = useState('')
  const [adminId, setAdminId] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [isAdminAuthed, setIsAdminAuthed] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [selectedFormation, setSelectedFormation] = useState<FormationType>('442')
  const [formationSlots, setFormationSlots] = useState<FormationSlotState[]>(() =>
    FORMATION_TEMPLATES['442'].map((slot) => ({ ...slot, player: null })),
  )
  const [benchPlayers, setBenchPlayers] = useState<string[]>([])
  const [showFormation, setShowFormation] = useState(false)
  const [formationLoading, setFormationLoading] = useState(false)
  const [formationSaving, setFormationSaving] = useState(false)
  const [formationError, setFormationError] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null)
  const [formationDate, setFormationDate] = useState(() => toLocalDateString(new Date()))
  const [formationQuarter, setFormationQuarter] = useState(1)
  const [formationCounts, setFormationCounts] = useState<Record<string, number>>({})
  const [selectedCheckName, setSelectedCheckName] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, index) => currentYear - index),
    [currentYear],
  )
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [kingResult, setKingResult] = useState<{ name: string; count: number } | null>(null)
  const [kingLoading, setKingLoading] = useState(false)
  const [kingError, setKingError] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString(new Date()))

  const supabaseReady = useMemo(() => {
    return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  }, [])

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date())
  }, [])

  const timeFormatter = useMemo(() => {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }, [])

  const attendeeNames = useMemo(() => {
    const names = checkIns
      .map((record) => record.name?.trim())
      .filter((name): name is string => Boolean(name))
    return Array.from(new Set(names))
  }, [checkIns])

  const loadGateState = useCallback(async () => {
    if (!supabaseReady) {
      return
    }

    setGateLoading(true)
    setGateError('')
    try {
      const active = await fetchGateState()
      setIsGateOpen(active)
    } catch (error: unknown) {
      console.error(error)
      if (error instanceof Error) {
        setGateError(error.message)
      } else {
        setGateError('출석 허용 상태를 불러오는 중 알 수 없는 오류가 발생했습니다.')
      }
    } finally {
      setGateLoading(false)
    }
  }, [supabaseReady])

  const loadCheckInsByDate = useCallback(
    async (date: string) => {
      if (!supabaseReady) {
        return
      }

      setListLoading(true)
      setListError('')
      try {
        const data = await fetchTodayCheckIns(date)
        const dedupMap = new Map<string, CheckInRecord>()
        data.forEach((record) => {
          const key = record.name?.trim()
          if (!key) {
            return
          }
          const existing = dedupMap.get(key)
          if (!existing || new Date(record.created_at) < new Date(existing.created_at)) {
            dedupMap.set(key, record)
          }
        })
        const deduped = Array.from(dedupMap.values()).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        setCheckIns(deduped)
      } catch (error: unknown) {
        console.error(error)
        if (error instanceof Error) {
          setListError(error.message)
        } else {
          setListError('출석 목록을 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setListLoading(false)
      }
    },
    [supabaseReady],
  )

  useEffect(() => {
    void loadGateState()
    const interval = setInterval(() => {
      void loadGateState()
    }, 15000)
    return () => clearInterval(interval)
  }, [loadGateState])

  useEffect(() => {
    if (!isGateOpen && !isAdminAuthed) {
      setShowAdminLogin(true)
    }

    if (isGateOpen && !isAdminAuthed) {
      setAdminError('')
      setShowAdminLogin(false)
    }
  }, [isGateOpen, isAdminAuthed])

  useEffect(() => {
    void loadCheckInsByDate(selectedDate)
  }, [loadCheckInsByDate, selectedDate])

  useEffect(() => {
    setFormationDate(selectedDate)
    setSelectedCheckName(null)
  }, [selectedDate])

  useEffect(() => {
    setSelectedPlayer(null)
  }, [formationDate, formationQuarter, selectedFormation])

  const handleFormationChange = useCallback(async (newFormation: FormationType) => {
    setSelectedFormation(newFormation)
    const template = FORMATION_TEMPLATES[newFormation]
    setFormationSlots(template.map((slot) => ({ ...slot, player: null })))
    setSelectedPlayer(null)
    
    if (supabaseReady) {
      try {
        const dayKey = formationDate.replace(/-/g, '')
        await upsertFormationType(dayKey, formationQuarter, newFormation)
      } catch (error) {
        console.error('포메이션 타입 저장 실패:', error)
      }
    }
  }, [formationDate, formationQuarter, supabaseReady])

  const refreshFormationCounts = useCallback(async () => {
    if (!supabaseReady) {
      return
    }

    const dayKey = selectedDate.replace(/-/g, '')
    try {
      const assignments = await fetchFormationAssignmentsByDay(dayKey)
      const counts = assignments.reduce<Record<string, number>>((accumulator, assignment) => {
        if (assignment.player_name) {
          accumulator[assignment.player_name] =
            (accumulator[assignment.player_name] ?? 0) + 1
        }
        return accumulator
      }, {})
      setFormationCounts(counts)
    } catch (error) {
      console.error(error)
    }
  }, [selectedDate, supabaseReady])

  useEffect(() => {
    void refreshFormationCounts()
  }, [refreshFormationCounts])

  useEffect(() => {
    if (selectedCheckName && !checkIns.some((item) => item.name === selectedCheckName)) {
      setSelectedCheckName(null)
    }
  }, [checkIns, selectedCheckName])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = userName.trim()
    if (!trimmedName) {
      setErrorMessage('이름을 입력해주세요.')
      setStatus('error')
      return
    }

    if (!supabaseReady) {
      setErrorMessage('Supabase 환경 변수가 설정되지 않았습니다.')
      setStatus('error')
      return
    }

    if (!isGateOpen) {
      setErrorMessage('현재 출석이 허용되어 있지 않습니다. 관리자에게 문의하세요.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      await checkIn({ userName: trimmedName })
      setStatus('success')
      setUserName('')
      await loadCheckInsByDate(selectedDate)
      setSelectedCheckName(null)
    } catch (error: unknown) {
      console.error(error)
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('출석 저장 중 알 수 없는 오류가 발생했습니다.')
      }
      setStatus('error')
    }
  }

  const handleAdminLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAdminError('')

    const trimmedId = adminId.trim()
    const trimmedPw = adminPassword.trim()

    if (!trimmedId || !trimmedPw) {
      setAdminError('관리자 아이디와 비밀번호를 입력해주세요.')
      return
    }

    if (
      trimmedId === ADMIN_CREDENTIALS.username &&
      trimmedPw === ADMIN_CREDENTIALS.password
    ) {
      setIsAdminAuthed(true)
      setAdminId('')
      setAdminPassword('')
      setShowAdminLogin(false)
    } else {
      setIsAdminAuthed(false)
      setAdminError('관리자 인증에 실패했습니다.')
    }
  }

  const handleAdminLogout = () => {
    setIsAdminAuthed(false)
    setShowAdminLogin(!isGateOpen)
    setKingResult(null)
    setKingError('')
  }

  const handleGateToggle = async (open: boolean) => {
    setGateLoading(true)
    setGateError('')
    try {
      await updateGateState(open)
      setIsGateOpen(open)
    } catch (error: unknown) {
      console.error(error)
      if (error instanceof Error) {
        setGateError(error.message)
      } else {
        setGateError('출석 허용 상태를 저장하는 중 알 수 없는 오류가 발생했습니다.')
      }
    } finally {
      setGateLoading(false)
    }
  }

  const updateBenchPlayers = useCallback(
    (slots: FormationSlotState[]) => {
      const assignedNames = slots
        .map((slot) => slot.player)
        .filter((name): name is string => Boolean(name))
      setBenchPlayers(attendeeNames.filter((name) => !assignedNames.includes(name)))
    },
    [attendeeNames],
  )

  useEffect(() => {
    updateBenchPlayers(formationSlots)
  }, [formationSlots, updateBenchPlayers, attendeeNames])

  const handleSelectBenchPlayer = useCallback((playerName: string) => {
    setSelectedPlayer((prev) => {
      if (prev?.name === playerName && prev?.source === 'bench') {
        return null
      }
      return { name: playerName, source: 'bench' }
    })
  }, [])

  const loadFormation = useCallback(async () => {
    if (!supabaseReady) {
      return
    }
    setFormationLoading(true)
    setFormationError('')
    try {
      const dayKey = formationDate.replace(/-/g, '')
      const [assignments, savedFormationType] = await Promise.all([
        fetchFormationAssignments(dayKey, formationQuarter),
        fetchFormationType(dayKey, formationQuarter),
      ])
      
      // 저장된 포메이션 타입이 있으면 사용, 없으면 기본값(442) 사용
      const currentFormation: FormationType = 
        (savedFormationType === '442' || savedFormationType === '4231') 
          ? (savedFormationType as FormationType) 
          : '442'
      
      // 포메이션 타입 설정
      setSelectedFormation(currentFormation)
      
      // 슬롯 설정 (저장된 선수 배치 포함)
      setFormationSlots(() => {
        const map = new Map(assignments.map((item) => [item.slot_id, item.player_name]))
        const template = FORMATION_TEMPLATES[currentFormation]
        const nextSlots = template.map((slot) => ({
          ...slot,
          player: map.get(slot.id) ?? null,
        }))
        updateBenchPlayers(nextSlots)
        return nextSlots
      })
      
      if (formationDate === selectedDate) {
        await refreshFormationCounts()
      }
    } catch (error) {
      console.error(error)
      if (error instanceof Error) {
        setFormationError(error.message)
      } else {
        setFormationError('포메이션 정보를 불러오는 중 알 수 없는 오류가 발생했습니다.')
      }
    } finally {
      setFormationLoading(false)
    }
  }, [formationDate, formationQuarter, refreshFormationCounts, selectedDate, supabaseReady, updateBenchPlayers])

  useEffect(() => {
    void loadFormation()
  }, [loadFormation])

  const handleAssignPlayer = useCallback(
    async (slotId: string, playerName: string, sourceSlotId?: string) => {
      if (!attendeeNames.includes(playerName)) {
        return
      }

      let targetPreviousPlayer: string | null = null
      setFormationSlots((prevSlots) => {
        const targetSlot = prevSlots.find((slot) => slot.id === slotId)
        targetPreviousPlayer = targetSlot?.player ?? null

        const updatedSlots = prevSlots.map((slot) => {
          if (slot.id === slotId) {
            return { ...slot, player: playerName }
          }
          if (sourceSlotId && slot.id === sourceSlotId) {
            return {
              ...slot,
              player:
                targetPreviousPlayer && targetPreviousPlayer !== playerName
                  ? targetPreviousPlayer
                  : null,
            }
          }
          if (slot.player === playerName && slot.id !== slotId && slot.id !== sourceSlotId) {
            return { ...slot, player: null }
          }
          return slot
        })
        updateBenchPlayers(updatedSlots)
        return updatedSlots
      })
      setFormationSaving(true)
      setFormationError('')
      try {
        const dayKey = formationDate.replace(/-/g, '')
        await upsertFormationAssignment(slotId, playerName, dayKey, formationQuarter)
        if (sourceSlotId && sourceSlotId !== slotId) {
          if (targetPreviousPlayer && targetPreviousPlayer !== playerName) {
            await upsertFormationAssignment(
              sourceSlotId,
              targetPreviousPlayer,
              dayKey,
              formationQuarter,
            )
          } else {
            await upsertFormationAssignment(sourceSlotId, null, dayKey, formationQuarter)
          }
        }
        if (formationDate === selectedDate) {
          await refreshFormationCounts()
        }
      } catch (error) {
        console.error(error)
        if (error instanceof Error) {
          setFormationError(error.message)
        } else {
          setFormationError('포지션을 저장하는 중 알 수 없는 오류가 발생했습니다.')
        }
        void loadFormation()
      } finally {
        setFormationSaving(false)
      }
    },
    [
      attendeeNames,
      formationDate,
      formationQuarter,
      loadFormation,
      refreshFormationCounts,
      selectedDate,
      updateBenchPlayers,
    ],
  )

  const handleClearSlot = useCallback(
    async (slotId: string) => {
      setFormationSlots((prevSlots) => {
        const updatedSlots = prevSlots.map((slot) =>
          slot.id === slotId ? { ...slot, player: null } : slot,
        )
        updateBenchPlayers(updatedSlots)
        return updatedSlots
      })
      setFormationSaving(true)
      setFormationError('')
      try {
        const dayKey = formationDate.replace(/-/g, '')
        await upsertFormationAssignment(slotId, null, dayKey, formationQuarter)
        if (formationDate === selectedDate) {
          await refreshFormationCounts()
        }
      } catch (error) {
        console.error(error)
        if (error instanceof Error) {
          setFormationError(error.message)
        } else {
          setFormationError('포지션을 초기화하는 중 알 수 없는 오류가 발생했습니다.')
        }
        void loadFormation()
      } finally {
        setFormationSaving(false)
      }
    },
    [
      formationDate,
      formationQuarter,
      loadFormation,
      refreshFormationCounts,
      selectedDate,
      selectedFormation,
      updateBenchPlayers,
    ],
  )

  const handleSlotClick = useCallback(
    (slotId: string) => {
      if (formationSaving) {
        return
      }

      const currentSlot = formationSlots.find((slot) => slot.id === slotId)

      if (!selectedPlayer) {
        if (currentSlot?.player) {
          setSelectedPlayer({ name: currentSlot.player, source: 'slot', slotId })
        }
        return
      }

      const { name, source, slotId: sourceSlotId } = selectedPlayer

      if (source === 'slot' && sourceSlotId === slotId) {
        setSelectedPlayer(null)
        return
      }

      void handleAssignPlayer(slotId, name, source === 'slot' ? sourceSlotId : undefined)
      setSelectedPlayer(null)
    },
    [formationSaving, formationSlots, handleAssignPlayer, selectedPlayer],
  )

  const handleResetFormation = useCallback(async () => {
    setFormationSaving(true)
    setFormationError('')
    try {
      const dayKey = formationDate.replace(/-/g, '')
      await resetFormationAssignments(dayKey, formationQuarter)
      const template = FORMATION_TEMPLATES[selectedFormation]
      const resetSlots = template.map((slot) => ({ ...slot, player: null }))
      setFormationSlots(resetSlots)
      updateBenchPlayers(resetSlots)
      if (formationDate === selectedDate) {
        await refreshFormationCounts()
      }
      setSelectedPlayer(null)
    } catch (error) {
      console.error(error)
      if (error instanceof Error) {
        setFormationError(error.message)
      } else {
        setFormationError('포메이션을 초기화하는 중 알 수 없는 오류가 발생했습니다.')
      }
      void loadFormation()
    } finally {
      setFormationSaving(false)
    }
  }, [
    formationDate,
    formationQuarter,
    loadFormation,
    refreshFormationCounts,
    selectedDate,
    updateBenchPlayers,
  ])

  const handleSelectCheck = useCallback(
    (name: string) => {
      if (!isAdminAuthed) {
        return
      }
      setSelectedCheckName((prev) => (prev === name ? null : name))
    },
    [isAdminAuthed],
  )

  const handleDeleteCheckIn = useCallback(
    async (name: string) => {
      if (!isAdminAuthed || !supabaseReady) {
        return
      }
      const target = checkIns.find((item) => item.name === name)
      const confirmMessage = target
        ? `${toLocalDateString(new Date(target.created_at))} ${target.name} 출석 기록을 삭제할까요?`
        : '선택한 출석 기록을 삭제할까요?'
      if (!window.confirm(confirmMessage)) {
        return
      }
      setDeleteLoading(true)
      setListError('')
      try {
        const dayKey = selectedDate.replace(/-/g, '')
        await deleteCheckIn(name, dayKey)
        await loadCheckInsByDate(selectedDate)
        setSelectedCheckName((prev) => (prev === name ? null : prev))
      } catch (error: unknown) {
        console.error(error)
        if (error instanceof Error) {
          setListError(error.message)
        } else {
          setListError('출석 정보를 삭제하는 중 오류가 발생했습니다.')
        }
      } finally {
        setDeleteLoading(false)
      }
    },
    [checkIns, isAdminAuthed, loadCheckInsByDate, selectedDate, supabaseReady],
  )

  const handleFetchAttendanceKing = async () => {
    if (!supabaseReady) {
      setKingError('Supabase 환경 변수가 설정되지 않았습니다.')
      return
    }

    setKingLoading(true)
    setKingError('')
    setKingResult(null)

    try {
      const records = await fetchAttendanceByYear(selectedYear)
      if (records.length === 0) {
        setKingError(`${selectedYear}년에 저장된 출석 데이터가 없습니다.`)
        return
      }

      const dailyAttendance = records.reduce<Record<string, Set<string>>>((acc, record) => {
        const rawName = record.name?.trim()
        if (!rawName) {
          return acc
        }
        const name = rawName
        const dateKey = record.created_at?.slice(0, 10)
        if (!dateKey) {
          return acc
        }

        if (!acc[name]) {
          acc[name] = new Set<string>()
        }
        acc[name].add(dateKey)
        return acc
      }, {})

      const sorted = Object.entries(dailyAttendance)
        .map(([name, dates]) => ({ name, count: dates.size }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

      const top = sorted[0]
      if (top) {
        setKingResult(top)
      } else {
        setKingError(`${selectedYear}년에 출석 데이터가 없습니다.`)
      }
    } catch (error: unknown) {
      console.error(error)
      if (error instanceof Error) {
        setKingError(error.message)
      } else {
        setKingError('출석왕 정보를 불러오는 중 알 수 없는 오류가 발생했습니다.')
      }
    } finally {
      setKingLoading(false)
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>명문FC 출석 체크</h1>
        <p>이름과 현재 시간을 저장합니다.</p>
        <p className="date">{todayLabel}</p>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <label className="label" htmlFor="userName">
          이름
        </label>
        <input
          id="userName"
          className="input"
          type="text"
          value={userName}
          onChange={(event) => setUserName(event.target.value)}
          placeholder="홍길동"
          autoComplete="name"
          disabled={status === 'loading'}
        />

        <button
          className="button"
          type="submit"
          disabled={status === 'loading' || gateLoading || !isGateOpen}
        >
          {status === 'loading' ? '저장 중...' : '출석 저장'}
        </button>
      </form>

      {!isAdminAuthed && showAdminLogin && (
        <form className="admin-form" onSubmit={handleAdminLogin}>
          <h2>관리자 인증</h2>

          <label className="label" htmlFor="adminId">
            관리자 아이디
          </label>
          <input
            id="adminId"
            className="input"
            value={adminId}
            onChange={(event) => setAdminId(event.target.value)}
            placeholder="admin"
            autoComplete="username"
          />

          <label className="label" htmlFor="adminPassword">
            비밀번호
          </label>
          <input
            id="adminPassword"
            className="input"
            type="password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            placeholder="********"
            autoComplete="current-password"
          />

          <button className="button" type="submit">
            관리자 로그인
          </button>
          {adminError && <p className="status-message error">{adminError}</p>}
        </form>
      )}

      {isAdminAuthed && (
        <section className="admin-panel">
          <h2>관리자 패널</h2>
          <p className={`admin-status ${isGateOpen ? 'open' : 'closed'}`}>
            {isGateOpen ? '현재 출석이 허용된 상태입니다.' : '현재 출석이 차단된 상태입니다.'}
          </p>
          <div className="admin-buttons">
            <button
              className="admin-button primary"
              type="button"
              onClick={() => void handleGateToggle(true)}
              disabled={gateLoading || isGateOpen}
            >
              출석 허용
            </button>
            <button
              className="admin-button secondary"
              type="button"
              onClick={() => void handleGateToggle(false)}
              disabled={gateLoading || !isGateOpen}
            >
              출석 마감
            </button>
            <button className="admin-button ghost" type="button" onClick={handleAdminLogout}>
              관리자 로그아웃
            </button>
          </div>

          <div className="admin-king">
            <h3>출석왕 조회</h3>
            <div className="king-controls">
              <label htmlFor="kingYear" className="label">
                연도 선택
              </label>
              <select
                id="kingYear"
                className="select"
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
              <button
                className="admin-button primary"
                type="button"
                onClick={() => void handleFetchAttendanceKing()}
                disabled={kingLoading}
              >
                {kingLoading ? '조회 중...' : '출석왕 조회'}
              </button>
            </div>
            {kingError && <p className="status-message error">{kingError}</p>}
            {!kingError && kingResult && (
              <div className="king-result">
                <span className="king-name">{kingResult.name}</span>
                <span className="king-count">{kingResult.count}회 출석</span>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="status">
        {status === 'success' && (
          <p className="status-message success">출석이 저장되었습니다.</p>
        )}
        {status === 'error' && <p className="status-message error">{errorMessage}</p>}
        {!supabaseReady && (
          <p className="status-message warning">
            Supabase 환경 변수를 설정하면 출석이 정상적으로 저장됩니다.
          </p>
        )}
        {gateError && <p className="status-message error">{gateError}</p>}
        {!gateError && !isGateOpen && (
          <p className="status-message warning">현재 출석이 닫혀 있습니다. 관리자에게 문의하세요.</p>
        )}
        {gateLoading && (
          <p className="status-message">출석 허용 상태를 확인하는 중입니다...</p>
        )}
        {isGateOpen && !isAdminAuthed && !showAdminLogin && (
          <button className="link-button" type="button" onClick={() => setShowAdminLogin(true)}>
            관리자 로그인
          </button>
        )}
      </section>

      {attendeeNames.length > 0 && (
        <section className={`formation-card ${showFormation ? 'open' : ''}`}>
          <div className="formation-header">
            <div>
              <h2>포메이션 배치</h2>
              <p className="formation-caption">
                {selectedFormation} 형태로 출석한 {attendeeNames.length}명을 원하는 포지션에 배치하세요.
              </p>
            </div>
            <div className="formation-controls">
              
              <input
                type="date"
                className="date-input"
                value={formationDate}
                onChange={(event) => setFormationDate(event.target.value)}
              />
              <select
                className="select formation-quarter"
                value={formationQuarter}
                onChange={(event) => setFormationQuarter(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((quarter) => (
                  <option key={quarter} value={quarter}>{`${quarter}쿼터`}</option>
                ))}
              </select>
            </div>
            <div className="formation-actions">
            <select
                className="select formation-type"
                value={selectedFormation}
                onChange={(event) => void handleFormationChange(event.target.value as FormationType)}
                disabled={formationSaving || formationLoading}
              >
                <option value="442">4-4-2</option>
                <option value="4231">4-2-3-1</option>
              </select>
              {showFormation && (
                <button
                  className="formation-action secondary"
                  type="button"
                  onClick={handleResetFormation}
                  disabled={formationSaving || formationLoading}
                >
                  초기화
                </button>
              )}
              <button
                className="formation-action primary"
                type="button"
                disabled={formationSaving || formationLoading}
                onClick={() =>
                  setShowFormation((prev) => {
                    const next = !prev
                    if (!prev) {
                      void loadFormation()
                    }
                    return next
                  })
                }
              >
                {showFormation ? '포메이션 닫기' : '포메이션 열기'}
              </button>
            </div>
          </div>
          {(formationLoading || formationError || formationSaving) && (
            <p className={`formation-info ${formationError ? 'error' : ''}`}>
              {formationError
                ? formationError
                : formationSaving
                  ? '포지션 변경 내용을 저장하는 중입니다...'
                  : '포메이션 정보를 불러오는 중입니다...'}
            </p>
          )}

          {showFormation && (
            <div className="formation-content">
              <div className="formation-bench">
                <h3>대기 명단</h3>
                {benchPlayers.length === 0 ? (
                  <p className="bench-empty">대기 중인 선수가 없습니다.</p>
                ) : (
                  <div className="bench-list">
                    {benchPlayers.map((name) => (
                      <button
                        type="button"
                        key={name}
                        className={`bench-player ${
                          selectedPlayer?.source === 'bench' && selectedPlayer.name === name
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => handleSelectBenchPlayer(name)}
                        disabled={formationSaving}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                <p className="bench-hint">
                  선수를 선택한 뒤 원하는 포지션을 탭하세요. 이미 배치된 자리를 다시 탭하면 다른 위치로 이동시킬
                  수 있습니다.
        </p>
      </div>

              <div className="formation-field">
                {formationSlots.map((slot) => {
                  const assignedPlayer = slot.player
                  const isActivePlayer = assignedPlayer ? attendeeNames.includes(assignedPlayer) : false
                  return (
                    <div
                      key={slot.id}
                      className={`formation-slot ${assignedPlayer ? 'filled' : ''} ${assignedPlayer && !isActivePlayer ? 'absent' : ''} ${selectedPlayer?.source === 'slot' && selectedPlayer.slotId === slot.id ? 'selected' : ''}`}
                      style={{ gridColumn: slot.column, gridRow: slot.row }}
                      onClick={() => handleSlotClick(slot.id)}
                    >
                      <span className="formation-slot-label">{slot.label}</span>
                      {assignedPlayer ? (
                        <div
                          className={`formation-player-wrapper ${
                            selectedPlayer?.source === 'slot' && selectedPlayer.slotId === slot.id ? 'active' : ''
                          }`}
                        >
                          <div className="formation-player-name">{assignedPlayer}</div>
                          {!isActivePlayer && <span className="formation-tag">미출석</span>}
                          <div className="formation-player-actions">
                            <button
                              type="button"
                              className="formation-assign"
                              disabled={formationSaving}
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedPlayer({ name: assignedPlayer, source: 'slot', slotId: slot.id })
                              }}
                            >
                              {selectedPlayer?.source === 'slot' && selectedPlayer.slotId === slot.id
                                ? '선택됨'
                                : '이동 선택'}
                            </button>
                            <button
                              type="button"
                              className="formation-remove"
                              disabled={formationSaving}
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleClearSlot(slot.id)
                                setSelectedPlayer((prev) =>
                                  prev?.source === 'slot' && prev.slotId === slot.id ? null : prev,
                                )
                              }}
                            >
                              비우기
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="formation-placeholder">
                          {selectedPlayer ? '선택한 선수를 배치하세요.' : '선수를 선택한 뒤 배치하세요.'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="list">
        <div className="list-header">
          <div>
            <h2>출석 목록</h2>
          </div>
          <div className="list-controls">
            <input
              type="date"
              className="date-input"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              disabled={listLoading}
            />
            <button
              className="list-refresh"
              type="button"
              onClick={() => void loadCheckInsByDate(selectedDate)}
              disabled={listLoading}
            >
              {listLoading ? '조회 중...' : '다시 조회'}
            </button>
          </div>
        </div>

        {listError && <p className="status-message error">{listError}</p>}

        {!listError && checkIns.length === 0 && !listLoading && (
          <p className="list-empty">
            {`${selectedDate} 날짜에 저장된 출석이 없습니다.`}
          </p>
        )}

        <ul className="list-items">
          {checkIns.map((record, index) => {
            const rawTime = record.created_at.slice(11, 19)
            const displayTime = rawTime.includes(':')
              ? rawTime
              : timeFormatter.format(new Date(record.created_at))
            const isSelected = isAdminAuthed && selectedCheckName === record.name
            const formationCount = formationCounts[record.name] ?? 0
            return (
              <li
                key={record.name}
                className={`list-item ${isAdminAuthed ? 'admin' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectCheck(record.name)}
              >
                <span className="list-item-order">{index + 1}</span>
                <span className="list-item-time">{displayTime}</span>
                <span className="list-item-name">
                  {record.name}
                  {formationCount > 0 ? ` (${formationCount})` : ''}
                </span>
                {isAdminAuthed && (
                  <button
                    type="button"
                    className="list-item-delete"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDeleteCheckIn(record.name)
                    }}
                    disabled={deleteLoading}
                  >
                    삭제
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

export default App

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import {
  checkIn,
  fetchAttendanceByYear,
  fetchGateState,
  fetchTodayCheckIns,
  updateGateState,
  type CheckInRecord,
} from './services/attendance'

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'mmfc1234',
}

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
  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, index) => currentYear - index),
    [currentYear],
  )
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [kingResult, setKingResult] = useState<{ name: string; count: number } | null>(null)
  const [kingLoading, setKingLoading] = useState(false)
  const [kingError, setKingError] = useState('')

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

  const loadTodayCheckIns = useCallback(async () => {
    if (!supabaseReady) {
      return
    }

    setListLoading(true)
    setListError('')
    try {
      const data = await fetchTodayCheckIns()
      const deduped = data.reduce<CheckInRecord[]>((acc, current) => {
        const existing = acc.find((item) => item.name === current.name)
        if (!existing) {
          acc.push(current)
        }
        return acc
      }, [])
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
  }, [supabaseReady])

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
    void loadTodayCheckIns()
  }, [loadTodayCheckIns])

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
      await loadTodayCheckIns()
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

      <section className="list">
        <div className="list-header">
          <h2>오늘의 출석 목록</h2>
          <button
            className="list-refresh"
            type="button"
            onClick={() => void loadTodayCheckIns()}
            disabled={listLoading}
          >
            {listLoading ? '새로고침 중...' : '새로고침'}
          </button>
        </div>

        {listError && <p className="status-message error">{listError}</p>}

        {!listError && checkIns.length === 0 && !listLoading && (
          <p className="list-empty">오늘 저장된 출석이 없습니다.</p>
        )}

        <ul className="list-items">
          {checkIns.map((record, index) => {
            const rawTime = record.created_at.slice(11, 19)
            const displayTime = rawTime.includes(':')
              ? rawTime
              : timeFormatter.format(new Date(record.created_at))
            return (
              <li key={`${record.created_at}-${record.name}-${index}`} className="list-item">
                <span className="list-item-order">{index + 1}</span>
                <span className="list-item-time">{displayTime}</span>
                <span className="list-item-name">{record.name}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

export default App

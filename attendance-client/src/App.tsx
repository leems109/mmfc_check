import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { checkIn } from './services/attendance'

function App() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const supabaseReady = useMemo(() => {
    return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedNumber = phoneNumber.trim()
    if (!trimmedNumber) {
      setErrorMessage('휴대폰 번호를 입력해주세요.')
      setStatus('error')
      return
    }

    if (!supabaseReady) {
      setErrorMessage('Supabase 환경 변수가 설정되지 않았습니다.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      await checkIn({ phoneNumber: trimmedNumber })
      setStatus('success')
      setPhoneNumber('')
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

  return (
    <div className="container">
      <header className="header">
        <h1>출석 체크</h1>
        <p>휴대폰 번호와 현재 시간을 Supabase에 저장합니다.</p>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <label className="label" htmlFor="phoneNumber">
          휴대폰 번호
        </label>
        <input
          id="phoneNumber"
          className="input"
          type="tel"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
          placeholder="010-1234-5678"
          autoComplete="tel"
          disabled={status === 'loading'}
        />

        <button className="button" type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? '저장 중...' : '출석 저장'}
        </button>
      </form>

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
      </section>
    </div>
  )
}

export default App

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SetupProfile() {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleSubmit = async () => {
    if (!nickname.trim()) {
      setError('ニックネームを入力してください')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('ログインが必要です')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: user.id, nickname: nickname.trim() })

    if (insertError) {
      setError('登録に失敗しました。もう一度お試しください。')
      setLoading(false)
      return
    }

    router.push('/')
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>ニックネーム登録</h1>
      <p style={{ marginTop: '16px', color: '#666' }}>
        他のユーザーに表示される名前です
      </p>
      <div style={{ marginTop: '24px' }}>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="ニックネームを入力"
          style={{
            padding: '10px 16px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            width: '250px',
          }}
        />
      </div>
      {error && <p style={{ color: 'red', marginTop: '8px' }}>{error}</p>}
      <div style={{ marginTop: '16px' }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '10px 24px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: '#4285F4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {loading ? '登録中...' : '登録する'}
        </button>
      </div>
    </div>
  )
}
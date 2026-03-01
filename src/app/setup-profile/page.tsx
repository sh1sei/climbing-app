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
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-main">ニックネーム登録</h1>
          <p className="text-sm text-text-sub mt-2">他のユーザーに表示される名前です</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="ニックネームを入力"
            className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-text-main text-base focus:outline-none focus:border-primary transition-colors placeholder:text-text-sub/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
          />

          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full mt-4 py-3 rounded-xl text-sm font-bold transition-colors ${
              loading
                ? 'bg-border text-text-sub cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {loading ? '登録中...' : '登録する'}
          </button>
        </div>
      </div>
    </div>
  )
}

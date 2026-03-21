'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type MyAscent = {
  id: string
  feeling: number
  created_at: string
  routes: {
    id: string
    grade: string
    image_url: string
    gyms: { name: string }[]
    walls: { name: string }[]
  }[]
}

type MyRoute = {
  id: string
  grade: string
  image_url: string
  created_at: string
  gyms: { name: string }[]
  walls: { name: string }[]
}

export default function MyPage() {
  const [user, setUser] = useState<User | null>(null)
  const [nickname, setNickname] = useState('')
  const [newNickname, setNewNickname] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [myAscents, setMyAscents] = useState<MyAscent[]>([])
  const [myRoutes, setMyRoutes] = useState<MyRoute[]>([])
  const [activeTab, setActiveTab] = useState<'ascents' | 'routes'>('ascents')
  const [loading, setLoading] = useState(true)
  const [nicknameMessage, setNicknameMessage] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single()
      if (profile) {
        setNickname(profile.nickname)
        setNewNickname(profile.nickname)
      }

      const { data: ascentsData } = await supabase
        .from('ascents')
        .select('id, feeling, created_at, routes(id, grade, image_url, gyms(name), walls(name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (ascentsData) setMyAscents(ascentsData as unknown as MyAscent[])

      const { data: routesData } = await supabase
        .from('routes')
        .select('id, grade, image_url, created_at, gyms(name), walls(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (routesData) setMyRoutes(routesData as unknown as MyRoute[])

      setLoading(false)
    }
    init()
  }, [])

  const handleNicknameUpdate = async () => {
    if (!newNickname.trim()) {
      setNicknameMessage('ニックネームを入力してください')
      return
    }
    if (newNickname.trim() === nickname) {
      setEditingNickname(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ nickname: newNickname.trim() })
      .eq('id', user!.id)

    if (error) {
      setNicknameMessage('更新に失敗しました')
      return
    }

    setNickname(newNickname.trim())
    setEditingNickname(false)
    setNicknameMessage('更新しました！')
    setTimeout(() => setNicknameMessage(''), 2000)
  }

  const getFeelingColor = (value: number) => {
    if (value < 0) {
      const intensity = Math.abs(value) / 5
      return `rgba(59, 130, 246, ${0.2 + intensity * 0.6})`
    }
    if (value > 0) {
      const intensity = value / 5
      return `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`
    }
    return '#f0f0f0'
  }

  const getFeelingLabel = (value: number) => {
    if (value <= -4) return 'かなり甘い'
    if (value <= -2) return '甘い'
    if (value === -1) return 'やや甘い'
    if (value === 0) return '妥当'
    if (value === 1) return 'やや辛い'
    if (value <= 3) return '辛い'
    return 'かなり辛い'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ fontSize: '20px', color: '#999' }}>読み込み中...</p>
      </div>
    )
  }

  return (
    <div style={{ margin: '0 auto', paddingBottom: '120px' }}>
      {/* ヘッダー */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e5e5',
      }}>
        <div style={{
          width: '100%',
          padding: '0 16px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>マイページ</h1>
        </div>
      </header>

      <div style={{ padding: '24px 16px' }}>

        {/* ニックネーム */}
        <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
          <p style={{ fontSize: '18px', color: '#666' }}>ニックネーム</p>
          {editingNickname ? (
            <div style={{ marginTop: '12px' }}>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                style={{
                  padding: '12px',
                  fontSize: '20px',
                  width: '100%',
                  borderRadius: '12px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleNicknameUpdate}
                  style={{
                    padding: '12px 24px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    backgroundColor: '#C9A96E',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                  }}
                >
                  保存
                </button>
                <button
                  onClick={() => { setEditingNickname(false); setNewNickname(nickname) }}
                  style={{
                    padding: '12px 24px',
                    fontSize: '18px',
                    backgroundColor: 'white',
                    color: '#333',
                    border: '1px solid #ccc',
                    borderRadius: '12px',
                    cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
              <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{nickname}</span>
              <button
                onClick={() => setEditingNickname(true)}
                style={{
                  padding: '8px 20px',
                  fontSize: '16px',
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                変更
              </button>
            </div>
          )}
          {nicknameMessage && <p style={{ marginTop: '8px', fontSize: '16px', color: '#C9A96E' }}>{nicknameMessage}</p>}
        </div>

        {/* 統計 */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '24px', backgroundColor: '#f0f8ff', borderRadius: '12px' }}>
            <p style={{ fontSize: '36px', fontWeight: 'bold' }}>{myAscents.length}</p>
            <p style={{ fontSize: '16px', color: '#666' }}>完登数</p>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '24px', backgroundColor: '#fff0f0', borderRadius: '12px' }}>
            <p style={{ fontSize: '36px', fontWeight: 'bold' }}>{myRoutes.length}</p>
            <p style={{ fontSize: '16px', color: '#666' }}>投稿数</p>
          </div>
        </div>

        {/* タブ切り替え */}
        <div style={{ marginTop: '32px', display: 'flex', borderBottom: '2px solid #eee' }}>
          <button
            onClick={() => setActiveTab('ascents')}
            style={{
              flex: 1,
              padding: '16px',
              fontSize: '20px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: activeTab === 'ascents' ? '3px solid #C9A96E' : '3px solid transparent',
              color: activeTab === 'ascents' ? '#C9A96E' : '#999',
              cursor: 'pointer',
            }}
          >
            完登履歴
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            style={{
              flex: 1,
              padding: '16px',
              fontSize: '20px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: activeTab === 'routes' ? '3px solid #C9A96E' : '3px solid transparent',
              color: activeTab === 'routes' ? '#C9A96E' : '#999',
              cursor: 'pointer',
            }}
          >
            自分の投稿
          </button>
        </div>

        {/* 完登履歴 */}
        {activeTab === 'ascents' && (
          <div style={{ marginTop: '16px' }}>
            {myAscents.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', fontSize: '20px', padding: '48px 0' }}>まだ完登記録がありません</p>
            ) : (
              myAscents.map((ascent) => {
                const route = ascent.routes?.[0]
                if (!route) return null
                return (
                  <a
                    key={ascent.id}
                    href={`/routes/${route.id}`}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      padding: '16px 0',
                      borderBottom: '1px solid #f0f0f0',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <img
                      src={route.image_url}
                      alt="課題"
                      style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '12px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '22px', fontWeight: 'bold' }}>{route.grade}</span>
                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '16px',
                            backgroundColor: getFeelingColor(ascent.feeling),
                          }}
                        >
                          {getFeelingLabel(ascent.feeling)}
                        </span>
                      </div>
                      <p style={{ fontSize: '16px', color: '#666', marginTop: '4px' }}>
                        {route.gyms?.[0]?.name} / {route.walls?.[0]?.name}
                      </p>
                      <p style={{ fontSize: '14px', color: '#999', marginTop: '4px' }}>
                        {new Date(ascent.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </a>
                )
              })
            )}
          </div>
        )}

        {/* 自分の投稿 */}
        {activeTab === 'routes' && (
          <div style={{ marginTop: '16px' }}>
            {myRoutes.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', fontSize: '20px', padding: '48px 0' }}>まだ課題を投稿していません</p>
            ) : (
              myRoutes.map((route) => (
                <a
                  key={route.id}
                  href={`/routes/${route.id}`}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '16px 0',
                    borderBottom: '1px solid #f0f0f0',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <img
                    src={route.image_url}
                    alt="課題"
                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '12px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '22px', fontWeight: 'bold' }}>{route.grade}</span>
                    <p style={{ fontSize: '16px', color: '#666', marginTop: '4px' }}>
                      {route.gyms?.[0]?.name} / {route.walls?.[0]?.name}
                    </p>
                    <p style={{ fontSize: '14px', color: '#999', marginTop: '4px' }}>
                      {new Date(route.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

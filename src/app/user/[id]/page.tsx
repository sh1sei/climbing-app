'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type MyAscent = {
  id: string
  feeling: number
  recommended: boolean
  created_at: string
  route_id: string
  route_grade: string
  route_image_url: string
  gym_name: string
  wall_name: string
}

type MyRoute = {
  id: string
  grade: string
  image_url: string
  created_at: string
  gym_name: string
  wall_name: string
}

export default function UserPage() {
  const params = useParams()
  const userId = params.id as string
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [nickname, setNickname] = useState('')
  const [newNickname, setNewNickname] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [myAscents, setMyAscents] = useState<MyAscent[]>([])
  const [myRoutes, setMyRoutes] = useState<MyRoute[]>([])
  const [activeTab, setActiveTab] = useState<'ascents' | 'routes'>('ascents')
  const [loading, setLoading] = useState(true)
  const [nicknameMessage, setNicknameMessage] = useState('')
  const supabase = createClient()

  const isOwner = currentUser?.id === userId

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUser(user)

      // ニックネーム取得
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .single()
      if (profile) {
        setNickname(profile.nickname)
        setNewNickname(profile.nickname)
      }

      // 完登履歴取得（個別にroute情報を取得）
      const { data: ascentsData } = await supabase
        .from('ascents')
        .select('id, feeling, recommended, created_at, route_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (ascentsData) {
        const formatted = await Promise.all(
          ascentsData.map(async (a: any) => {
            const { data: routeData } = await supabase
              .from('routes')
              .select('id, grade, image_url, gyms(name), walls(name)')
              .eq('id', a.route_id)
              .single()
            return {
              id: a.id,
              feeling: a.feeling,
              recommended: a.recommended,
              created_at: a.created_at,
              route_id: a.route_id,
              route_grade: routeData?.grade || '',
              route_image_url: routeData?.image_url || '',
              gym_name: (routeData as any)?.gyms?.[0]?.name || '',
              wall_name: (routeData as any)?.walls?.[0]?.name || '',
            }
          })
        )
        setMyAscents(formatted)
      }

      // 投稿した課題取得
      const { data: routesData } = await supabase
        .from('routes')
        .select('id, grade, image_url, created_at, gyms(name), walls(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (routesData) {
        const formatted = routesData.map((r: any) => ({
          id: r.id,
          grade: r.grade,
          image_url: r.image_url,
          created_at: r.created_at,
          gym_name: r.gyms?.[0]?.name || '',
          wall_name: r.walls?.[0]?.name || '',
        }))
        setMyRoutes(formatted)
      }

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
      .eq('id', userId)

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

  if (loading) return <p>読み込み中...</p>

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
      <a href="/" style={{ color: '#4285F4', textDecoration: 'none' }}>← ホームに戻る</a>

      {/* ニックネーム */}
      <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
        {isOwner && editingNickname ? (
          <div>
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              style={{ padding: '8px', fontSize: '16px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <button
                onClick={handleNicknameUpdate}
                style={{
                  padding: '6px 16px',
                  fontSize: '14px',
                  backgroundColor: '#4285F4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                保存
              </button>
              <button
                onClick={() => { setEditingNickname(false); setNewNickname(nickname) }}
                style={{
                  padding: '6px 16px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px', fontWeight: 'bold' }}>{nickname}</span>
            {isOwner && (
              <button
                onClick={() => setEditingNickname(true)}
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                変更
              </button>
            )}
          </div>
        )}
        {nicknameMessage && <p style={{ marginTop: '4px', fontSize: '12px', color: '#4285F4' }}>{nicknameMessage}</p>}
      </div>

      {/* 統計 */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '16px', backgroundColor: '#f0f8ff', borderRadius: '12px' }}>
          <p style={{ fontSize: '28px', fontWeight: 'bold' }}>{myAscents.length}</p>
          <p style={{ fontSize: '12px', color: '#666' }}>完登数</p>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '16px', backgroundColor: '#fff0f0', borderRadius: '12px' }}>
          <p style={{ fontSize: '28px', fontWeight: 'bold' }}>{myRoutes.length}</p>
          <p style={{ fontSize: '12px', color: '#666' }}>投稿数</p>
        </div>
      </div>

      {/* タブ */}
      <div style={{ marginTop: '24px', display: 'flex', borderBottom: '2px solid #eee' }}>
        <button
          onClick={() => setActiveTab('ascents')}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '14px',
            fontWeight: 'bold',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'ascents' ? '2px solid #4285F4' : '2px solid transparent',
            color: activeTab === 'ascents' ? '#4285F4' : '#999',
            cursor: 'pointer',
          }}
        >
          完登履歴
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '14px',
            fontWeight: 'bold',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'routes' ? '2px solid #4285F4' : '2px solid transparent',
            color: activeTab === 'routes' ? '#4285F4' : '#999',
            cursor: 'pointer',
          }}
        >
          投稿した課題
        </button>
      </div>

      {/* 完登履歴 */}
      {activeTab === 'ascents' && (
        <div style={{ marginTop: '16px' }}>
          {myAscents.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999' }}>まだ完登記録がありません</p>
          ) : (
            myAscents.map((ascent) => (
              <a
                key={ascent.id}
                href={`/routes/${ascent.route_id}`}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <img
                  src={ascent.route_image_url}
                  alt="課題"
                  style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{ascent.route_grade}</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {ascent.recommended && (
                        <span style={{ fontSize: '14px' }}>👍</span>
                      )}
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          backgroundColor: getFeelingColor(ascent.feeling),
                        }}
                      >
                        {getFeelingLabel(ascent.feeling)}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    {ascent.gym_name} / {ascent.wall_name}
                  </p>
                  <p style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                    {new Date(ascent.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </a>
            ))
          )}
        </div>
      )}

      {/* 投稿した課題 */}
      {activeTab === 'routes' && (
        <div style={{ marginTop: '16px' }}>
          {myRoutes.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999' }}>まだ課題を投稿していません</p>
          ) : (
            myRoutes.map((route) => (
              <a
                key={route.id}
                href={`/routes/${route.id}`}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <img
                  src={route.image_url}
                  alt="課題"
                  style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{route.grade}</span>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    {route.gym_name} / {route.wall_name}
                  </p>
                  <p style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                    {new Date(route.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  )
}

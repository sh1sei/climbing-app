'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

type Gym = {
  id: string
  name: string
}

type Wall = {
  id: string
  name: string
  gym_id: string
  gyms: { name: string }[]
}

export default function AdminWalls() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [walls, setWalls] = useState<Wall[]>([])
  const [selectedGymId, setSelectedGymId] = useState('')
  const [wallName, setWallName] = useState('')
  const [message, setMessage] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchGyms()
    fetchWalls()
  }, [])

  const fetchGyms = async () => {
    const { data } = await supabase.from('gyms').select('id, name').order('name')
    if (data) setGyms(data)
  }

  const fetchWalls = async () => {
    const { data } = await supabase
      .from('walls')
      .select('id, name, gym_id, gyms(name)')
      .order('created_at', { ascending: false })
    if (data) setWalls(data as Wall[])
  }

  const handleAdd = async () => {
    if (!selectedGymId || !wallName.trim()) {
      setMessage('ジムと壁の名前を入力してください')
      return
    }

    const { error } = await supabase.from('walls').insert({
      gym_id: selectedGymId,
      name: wallName.trim(),
    })

    if (error) {
      setMessage('登録に失敗しました')
      return
    }

    setWallName('')
    setMessage('登録しました！')
    fetchWalls()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この壁を削除しますか？')) return
    await supabase.from('walls').delete().eq('id', id)
    fetchWalls()
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px' }}>
      <h1>壁管理</h1>

      <div style={{ marginTop: '24px' }}>
        <div style={{ marginBottom: '12px' }}>
          <select
            value={selectedGymId}
            onChange={(e) => setSelectedGymId(e.target.value)}
            style={{ padding: '8px', width: '100%', fontSize: '16px' }}
          >
            <option value="">ジムを選択</option>
            {gyms.map((gym) => (
              <option key={gym.id} value={gym.id}>{gym.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            value={wallName}
            onChange={(e) => setWallName(e.target.value)}
            placeholder="壁の名前（例: スラブ、前傾壁）"
            style={{ padding: '8px', width: '100%', fontSize: '16px' }}
          />
        </div>
        <button
          onClick={handleAdd}
          style={{
            padding: '10px 24px',
            fontSize: '16px',
            backgroundColor: '#4285F4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          壁を登録
        </button>
        {message && <p style={{ marginTop: '8px', color: '#666' }}>{message}</p>}
      </div>

      <h2 style={{ marginTop: '40px' }}>登録済みの壁</h2>
      {walls.length === 0 ? (
        <p style={{ color: '#999' }}>まだ壁が登録されていません</p>
      ) : (
        walls.map((wall) => (
          <div
            key={wall.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong>{wall.name}</strong>
              <p style={{ fontSize: '14px', color: '#666' }}>
                {wall.gyms?.[0]?.name}
              </p>
            </div>
            <button
              onClick={() => handleDelete(wall.id)}
              style={{
                padding: '4px 12px',
                backgroundColor: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              削除
            </button>
          </div>
        ))
      )}
    </div>
  )
}
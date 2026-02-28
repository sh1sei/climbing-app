'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Gym = { id: string; name: string }
type Wall = { id: string; name: string; gym_id: string }

const GRADES = [
  '5級-','5級','5級+',
  '4級-','4級','4級+',
  '3級-','3級','3級+',
  '2級-','2級','2級+',
  '1級-','1級','1級+',
  '初段-','初段','初段+',
  '二段-','二段','二段+',
  '三段-','三段','三段+',
]

const TAGS = ['キャンパ課題', '足限定ホールドあり', 'マッチなし']

export default function NewRoute() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [walls, setWalls] = useState<Wall[]>([])
  const [selectedGymId, setSelectedGymId] = useState('')
  const [selectedWallId, setSelectedWallId] = useState('')
  const [grade, setGrade] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const fetchGyms = async () => {
      const { data } = await supabase.from('gyms').select('id, name').order('name')
      if (data) setGyms(data)
    }
    fetchGyms()
  }, [])

  useEffect(() => {
    const fetchWalls = async () => {
      if (!selectedGymId) {
        setWalls([])
        setSelectedWallId('')
        return
      }
      const { data } = await supabase
        .from('walls')
        .select('id, name, gym_id')
        .eq('gym_id', selectedGymId)
        .order('name')
      if (data) setWalls(data)
      setSelectedWallId('')
    }
    fetchWalls()
  }, [selectedGymId])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    if (!selectedGymId || !selectedWallId || !grade || !image) {
      setMessage('全ての項目を入力し、写真を選択してください')
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage('ログインが必要です')
      setLoading(false)
      return
    }

    const ext = image.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('route-images')
      .upload(fileName, image)

    if (uploadError) {
      setMessage('画像のアップロードに失敗しました')
      setLoading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('route-images')
      .getPublicUrl(fileName)

    const { error: insertError } = await supabase.from('routes').insert({
      gym_id: selectedGymId,
      wall_id: selectedWallId,
      grade,
      tags: selectedTags,
      image_url: urlData.publicUrl,
      user_id: user.id,
    })

    if (insertError) {
      setMessage('ルートの登録に失敗しました')
      setLoading(false)
      return
    }

    setMessage('投稿完了しました！')
    setImage(null)
    setPreview(null)
    setGrade('')
    setSelectedTags([])
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px' }}>
      <h1>ルート投稿</h1>

      {/* 写真選択 */}
      <div style={{ marginTop: '24px' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold' }}>写真</label>
        <div style={{ marginTop: '8px' }}>
          <input type="file" accept="image/*" onChange={handleImageChange} />
        </div>
        {preview && (
          <img
            src={preview}
            alt="プレビュー"
            style={{ marginTop: '12px', maxWidth: '100%', borderRadius: '8px' }}
          />
        )}
      </div>

      {/* ジム選択 */}
      <div style={{ marginTop: '20px' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold' }}>ジム</label>
        <select
          value={selectedGymId}
          onChange={(e) => setSelectedGymId(e.target.value)}
          style={{ display: 'block', marginTop: '8px', padding: '8px', width: '100%', fontSize: '16px' }}
        >
          <option value="">ジムを選択</option>
          {gyms.map((gym) => (
            <option key={gym.id} value={gym.id}>{gym.name}</option>
          ))}
        </select>
      </div>

      {/* 壁選択 */}
      <div style={{ marginTop: '20px' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold' }}>壁</label>
        <select
          value={selectedWallId}
          onChange={(e) => setSelectedWallId(e.target.value)}
          style={{ display: 'block', marginTop: '8px', padding: '8px', width: '100%', fontSize: '16px' }}
          disabled={!selectedGymId}
        >
          <option value="">壁を選択</option>
          {walls.map((wall) => (
            <option key={wall.id} value={wall.id}>{wall.name}</option>
          ))}
        </select>
      </div>

      {/* グレード選択 */}
      <div style={{ marginTop: '20px' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold' }}>グレード</label>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          style={{ display: 'block', marginTop: '8px', padding: '8px', width: '100%', fontSize: '16px' }}
        >
          <option value="">グレードを選択</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* 特殊属性 */}
      <div style={{ marginTop: '20px' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold' }}>特殊属性</label>
        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: selectedTags.includes(tag) ? '2px solid #4285F4' : '1px solid #ccc',
                backgroundColor: selectedTags.includes(tag) ? '#e8f0fe' : 'white',
                color: selectedTags.includes(tag) ? '#4285F4' : '#333',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 投稿ボタン */}
      <div style={{ marginTop: '32px' }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '12px 32px',
            fontSize: '16px',
            backgroundColor: loading ? '#ccc' : '#4285F4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {loading ? '投稿中...' : 'ルートを投稿する'}
        </button>
        {message && (
          <p style={{
            marginTop: '8px',
            color: message === '投稿完了しました！' ? 'green' : 'red',
          }}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
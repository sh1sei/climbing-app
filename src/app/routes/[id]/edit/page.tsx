'use client'

import { useEffect, useState } from 'react'
import { createClient, ADMIN_EMAIL } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

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

export default function EditRoutePage() {
  const params = useParams()
  const routeId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [walls, setWalls] = useState<Wall[]>([])
  const [selectedWallId, setSelectedWallId] = useState('')
  const [grade, setGrade] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [currentImageUrl, setCurrentImageUrl] = useState('')
  const [newImage, setNewImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [gymName, setGymName] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      // 課題データ取得
      const { data: routeData } = await supabase
        .from('routes')
        .select('id, grade, tags, image_url, user_id, gym_id, wall_id, gyms(name)')
        .eq('id', routeId)
        .single()

      if (!routeData) {
        router.push('/')
        return
      }

      // 権限チェック（投稿者本人 or 管理者）
      if (routeData.user_id !== user.id && user.email !== ADMIN_EMAIL) {
        router.push('/')
        return
      }

      setGrade(routeData.grade)
      setSelectedTags(routeData.tags || [])
      setCurrentImageUrl(routeData.image_url)
      setSelectedWallId(routeData.wall_id)
      setGymName((routeData as any).gyms?.[0]?.name || '')

      // 同じジムの壁を取得
      const { data: wallsData } = await supabase
        .from('walls')
        .select('id, name, gym_id')
        .eq('gym_id', routeData.gym_id)
        .order('name')
      if (wallsData) setWalls(wallsData)

      setLoading(false)
    }
    init()
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNewImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    if (!selectedWallId || !grade) {
      setMessage('壁とグレードを選択してください')
      return
    }

    setSubmitting(true)

    let imageUrl = currentImageUrl

    // 画像が変更された場合
    if (newImage && user) {
      // 古い画像を削除
      const oldPath = currentImageUrl.split('/route-images/')[1]
      if (oldPath) {
        await supabase.storage.from('route-images').remove([oldPath])
      }

      // 新しい画像をアップロード
      const ext = newImage.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('route-images')
        .upload(fileName, newImage)

      if (uploadError) {
        setMessage('画像のアップロードに失敗しました')
        setSubmitting(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('route-images')
        .getPublicUrl(fileName)
      imageUrl = urlData.publicUrl
    }

    const { error } = await supabase
      .from('routes')
      .update({
        wall_id: selectedWallId,
        grade,
        tags: selectedTags,
        image_url: imageUrl,
      })
      .eq('id', routeId)

    if (error) {
      setMessage('更新に失敗しました')
      setSubmitting(false)
      return
    }

    router.push(`/routes/${routeId}`)
  }

  if (loading) return <p>読み込み中...</p>

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px' }}>
      <a href={`/routes/${routeId}`} style={{ color: '#4285F4', textDecoration: 'none' }}>
        ← 戻る
      </a>
      <h1 style={{ marginTop: '12px' }}>課題を編集</h1>
      <p style={{ fontSize: '14px', color: '#666' }}>{gymName}</p>

      {/* 画像 */}
      <div style={{ marginTop: '24px' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold' }}>写真</label>
        <div style={{ marginTop: '8px' }}>
          <img
            src={preview || currentImageUrl}
            alt="課題写真"
            style={{ width: '100%', borderRadius: '8px', marginBottom: '8px' }}
          />
          <input type="file" accept="image/*" onChange={handleImageChange} />
          {newImage && (
            <p style={{ fontSize: '12px', color: '#4285F4', marginTop: '4px' }}>
              新しい画像が選択されています
            </p>
          )}
        </div>
      </div>

      {/* 壁選択 */}
      <div style={{ marginTop: '20px' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold' }}>壁</label>
        <select
          value={selectedWallId}
          onChange={(e) => setSelectedWallId(e.target.value)}
          style={{ display: 'block', marginTop: '8px', padding: '8px', width: '100%', fontSize: '16px' }}
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

      {/* 更新ボタン */}
      <div style={{ marginTop: '32px' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '12px 32px',
            fontSize: '16px',
            backgroundColor: submitting ? '#ccc' : '#4285F4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {submitting ? '更新中...' : '更新する'}
        </button>
        {message && <p style={{ marginTop: '8px', color: 'red' }}>{message}</p>}
      </div>
    </div>
  )
}

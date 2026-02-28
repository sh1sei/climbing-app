'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type Gym = {
  id: string
  name: string
  latitude: number
  longitude: number
}

type Route = {
  id: string
  grade: string
  tags: string[]
  image_url: string
  created_at: string
  gym_id: string
  gyms: { name: string }[]
  walls: { name: string }[]
  profiles: { nickname: string }[]
  ascent_count: number
  recommend_count: number
}

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

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [gyms, setGyms] = useState<Gym[]>([])
  const [allRoutes, setAllRoutes] = useState<Route[]>([])
  const [filteredRoutes, setFilteredRoutes] = useState<Route[]>([])
  const [selectedGymId, setSelectedGymId] = useState<string>('all')
  const [gradeFrom, setGradeFrom] = useState<string>('')
  const [gradeTo, setGradeTo] = useState<string>('')
  const [showGradeFilter, setShowGradeFilter] = useState(false)
  const [loading, setLoading] = useState(true)
  const [locationStatus, setLocationStatus] = useState<string>('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUser(user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', user.id)
          .single()

        if (!profile) {
          router.push('/setup-profile')
          return
        }
        setNickname(profile.nickname)
      }

      const { data: gymsData } = await supabase
        .from('gyms')
        .select('id, name, latitude, longitude')
        .order('name')

      let initialGymId = 'all'

      if (gymsData && gymsData.length > 0) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 300000,
            })
          })

          const userLat = position.coords.latitude
          const userLon = position.coords.longitude

          const sortedGyms = [...gymsData].sort((a, b) => {
            const distA = getDistanceKm(userLat, userLon, a.latitude, a.longitude)
            const distB = getDistanceKm(userLat, userLon, b.latitude, b.longitude)
            return distA - distB
          })

          setGyms(sortedGyms)

          const nearestGym = sortedGyms[0]
          const distance = getDistanceKm(userLat, userLon, nearestGym.latitude, nearestGym.longitude)

          if (distance < 2) {
            initialGymId = nearestGym.id
            setSelectedGymId(nearestGym.id)
            setLocationStatus(`📍 ${nearestGym.name}（${distance.toFixed(1)}km）`)
          }
        } catch {
          setGyms(gymsData)
        }
      } else {
        setGyms([])
      }

      await fetchRoutes(initialGymId)
      setLoading(false)
    }
    init()
  }, [])

  const fetchRoutes = async (gymId?: string) => {
    let query = supabase
      .from('routes')
      .select('id, grade, tags, image_url, created_at, user_id, gym_id, gyms(name), walls(name)')
      .order('created_at', { ascending: false })

    if (gymId && gymId !== 'all') {
      query = query.eq('gym_id', gymId)
    }

    const { data: routesData } = await query

    if (routesData) {
      const routesWithCount = await Promise.all(
        routesData.map(async (route: any) => {
          const { count: ascentCount } = await supabase
            .from('ascents')
            .select('*', { count: 'exact', head: true })
            .eq('route_id', route.id)
          const { count: recommendCount } = await supabase
            .from('ascents')
            .select('*', { count: 'exact', head: true })
            .eq('route_id', route.id)
            .eq('recommended', true)
          const { data: profile } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', route.user_id)
            .single()
          return {
            ...route,
            ascent_count: ascentCount || 0,
            recommend_count: recommendCount || 0,
            profiles: profile ? [profile] : [],
          }
        })
      )
      setAllRoutes(routesWithCount as Route[])
      applyGradeFilter(routesWithCount as Route[], gradeFrom, gradeTo)
    }
  }

  const applyGradeFilter = (routes: Route[], from: string, to: string) => {
    if (!from && !to) {
      setFilteredRoutes(routes)
      return
    }

    const fromIndex = from ? GRADES.indexOf(from) : 0
    const toIndex = to ? GRADES.indexOf(to) : GRADES.length - 1

    const filtered = routes.filter((route) => {
      const routeIndex = GRADES.indexOf(route.grade)
      if (routeIndex === -1) return true
      return routeIndex >= fromIndex && routeIndex <= toIndex
    })

    setFilteredRoutes(filtered)
  }

  const handleGymFilter = async (gymId: string) => {
    setSelectedGymId(gymId)
    await fetchRoutes(gymId)
  }

  const handleGradeFromChange = (value: string) => {
    setGradeFrom(value)
    applyGradeFilter(allRoutes, value, gradeTo)
  }

  const handleGradeToChange = (value: string) => {
    setGradeTo(value)
    applyGradeFilter(allRoutes, gradeFrom, value)
  }

  const clearGradeFilter = () => {
    setGradeFrom('')
    setGradeTo('')
    setFilteredRoutes(allRoutes)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setNickname(null)
  }

  if (loading) return <p>読み込み中...</p>

  if (!user) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h1>カベログ</h1>
        <p>課題を記録・共有しよう</p>
        <a href="/login" style={{ fontSize: '18px', color: '#4285F4' }}>
          ログインはこちら
        </a>
      </div>
    )
  }

  const gradeFilterActive = gradeFrom || gradeTo

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '20px' }}>カベログ</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a href={`/user/${user.id}`} style={{ fontSize: '14px', color: '#333', textDecoration: 'none' }}>
            {nickname}
          </a>
          <button onClick={handleLogout} style={{ fontSize: '12px', cursor: 'pointer' }}>
            ログアウト
          </button>
        </div>
      </div>

      {locationStatus && (
        <p style={{ fontSize: '12px', color: '#4285F4', marginTop: '8px' }}>{locationStatus}</p>
      )}

      <div style={{ marginTop: '16px' }}>
        <a
          href="/routes/new"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '12px',
            backgroundColor: '#4285F4',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '16px',
          }}
        >
          ＋ 課題を投稿する
        </a>
      </div>

      {/* ジムフィルター */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => handleGymFilter('all')}
          style={{
            padding: '6px 16px',
            borderRadius: '20px',
            border: selectedGymId === 'all' ? '2px solid #4285F4' : '1px solid #ccc',
            backgroundColor: selectedGymId === 'all' ? '#e8f0fe' : 'white',
            color: selectedGymId === 'all' ? '#4285F4' : '#333',
            cursor: 'pointer',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          すべて
        </button>
        {gyms.map((gym) => (
          <button
            key={gym.id}
            onClick={() => handleGymFilter(gym.id)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: selectedGymId === gym.id ? '2px solid #4285F4' : '1px solid #ccc',
              backgroundColor: selectedGymId === gym.id ? '#e8f0fe' : 'white',
              color: selectedGymId === gym.id ? '#4285F4' : '#333',
              cursor: 'pointer',
              fontSize: '14px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {gym.name}
          </button>
        ))}
      </div>

      {/* グレードフィルター */}
      <div style={{ marginTop: '12px' }}>
        <button
          onClick={() => setShowGradeFilter(!showGradeFilter)}
          style={{
            padding: '6px 16px',
            borderRadius: '20px',
            border: gradeFilterActive ? '2px solid #4285F4' : '1px solid #ccc',
            backgroundColor: gradeFilterActive ? '#e8f0fe' : 'white',
            color: gradeFilterActive ? '#4285F4' : '#333',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          グレード {gradeFilterActive ? `（${gradeFrom || '---'} 〜 ${gradeTo || '---'}）` : '▼'}
        </button>

        {showGradeFilter && (
          <div style={{
            marginTop: '8px',
            padding: '12px',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={gradeFrom}
                onChange={(e) => handleGradeFromChange(e.target.value)}
                style={{ padding: '6px', fontSize: '14px', flex: 1 }}
              >
                <option value="">下限なし</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <span>〜</span>
              <select
                value={gradeTo}
                onChange={(e) => handleGradeToChange(e.target.value)}
                style={{ padding: '6px', fontSize: '14px', flex: 1 }}
              >
                <option value="">上限なし</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            {gradeFilterActive && (
              <button
                onClick={clearGradeFilter}
                style={{
                  marginTop: '8px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                クリア
              </button>
            )}
          </div>
        )}
      </div>

      {/* 課題一覧 */}
      <div style={{ marginTop: '16px' }}>
        {filteredRoutes.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>
            {allRoutes.length === 0 ? 'まだ課題が投稿されていません' : '条件に一致する課題がありません'}
          </p>
        ) : (
          filteredRoutes.map((route) => (
            <a
              key={route.id}
              href={`/routes/${route.id}`}
              style={{
                display: 'block',
                border: '1px solid #ddd',
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: '16px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <img
                src={route.image_url}
                alt="課題写真"
                style={{ width: '100%', height: '250px', objectFit: 'cover' }}
              />
              <div style={{ padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{route.grade}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {route.recommend_count > 0 && (
                      <span style={{ fontSize: '14px' }}>👍 {route.recommend_count}</span>
                    )}
                    <span style={{ fontSize: '14px', color: '#666' }}>
                      完登 {route.ascent_count}人
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                  {route.gyms?.[0]?.name} / {route.walls?.[0]?.name}
                </p>
                {route.tags.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {route.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '2px 10px',
                          backgroundColor: '#f0f0f0',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                  投稿者: {route.profiles?.[0]?.nickname} ・ {new Date(route.created_at).toLocaleDateString('ja-JP')}
                </p>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  )
}

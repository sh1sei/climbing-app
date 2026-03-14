'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

/* ========== 型定義 ========== */

type Gym = {
  id: string
  name: string
  latitude: number
  longitude: number
}

type Wall = {
  id: string
  gym_id: string
  name: string
}

type RouteWithCounts = {
  id: string
  grade: string
  tags: string[]
  image_url: string
  description: string | null
  hold_type: string[] | null
  style: string | null
  created_at: string
  gym_id: string
  wall_id: string
  user_id: string
  gym_name: string
  wall_name: string
  poster_nickname: string
  ascent_count: number
  recommend_count: number
  favorite_count: number
}

/* ========== 定数 ========== */

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

const HOLD_TYPES = ['カチ', 'ピンチ', 'ポッケ', 'スローパー', 'ボリューム']
const STYLES = ['ショート', 'ストレニ']
const STYLE_LABELS: Record<string, string> = {
  'ショート': 'ショートハード系',
  'ストレニ': 'ストレニアス系',
}

type SortType = 'new' | 'repeat' | 'recommend'
const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'new', label: '新着' },
  { value: 'repeat', label: 'リピート順' },
  { value: 'recommend', label: 'おすすめ順' },
]

/* ========== ユーティリティ ========== */

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

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}日前`
  const months = Math.floor(days / 30)
  return `${months}ヶ月前`
}

/* ========== フィルターチップ ========== */

function Chip({
  label,
  active,
  onClick,
  hasDropdown = false,
}: {
  label: string
  active: boolean
  onClick: () => void
  hasDropdown?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-0.5 px-3 py-1.5 rounded-full text-xs font-medium
        border transition-all duration-150 whitespace-nowrap shrink-0
        ${active
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-white/80 text-text-main border-border hover:border-primary/50'
        }
      `}
    >
      {label}
      {hasDropdown && (
        <svg width="10" height="10" viewBox="0 0 10 10" className="ml-0.5 opacity-60">
          <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

/* ========== ドロップダウン ========== */

function Dropdown({
  items,
  onSelect,
  selectedValue,
}: {
  items: { value: string; label: string }[]
  onSelect: (value: string) => void
  selectedValue: string
}) {
  return (
    <div className="absolute top-full mt-1.5 left-0 bg-white border border-border rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto min-w-[160px] py-1">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onSelect(item.value)}
          className={`
            block w-full px-4 py-2.5 text-xs text-left transition-colors
            ${selectedValue === item.value
              ? 'bg-primary-light text-primary font-bold'
              : 'text-text-main hover:bg-primary-light/50'
            }
          `}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/* ========== チェックボックスドロップダウン ========== */

function CheckDropdown({
  items,
  activeItems,
  onToggle,
}: {
  items: { value: string; label: string }[]
  activeItems: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="absolute top-full mt-1.5 left-0 bg-white border border-border rounded-xl shadow-lg z-50 min-w-[180px] py-1">
      {items.map((item) => {
        const isActive = activeItems.includes(item.value)
        return (
          <button
            key={item.value}
            onClick={() => onToggle(item.value)}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-left hover:bg-primary-light/50 transition-colors"
          >
            <span className={`
              w-4 h-4 rounded border flex items-center justify-center text-[8px]
              ${isActive
                ? 'bg-primary border-primary text-white'
                : 'border-border bg-white'
              }
            `}>
              {isActive && '✓'}
            </span>
            <span className={isActive ? 'text-primary font-bold' : 'text-text-main'}>
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ========== メインコンポーネント ========== */

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [gyms, setGyms] = useState<Gym[]>([])
  const [walls, setWalls] = useState<Wall[]>([])
  const [routes, setRoutes] = useState<RouteWithCounts[]>([])
  const [filteredRoutes, setFilteredRoutes] = useState<RouteWithCounts[]>([])
  const [loading, setLoading] = useState(true)

  // フィルター状態
  const [selectedGymId, setSelectedGymId] = useState<string>('all')
  const [selectedWallId, setSelectedWallId] = useState<string>('all')
  const [gradeFrom, setGradeFrom] = useState<string>('')
  const [gradeTo, setGradeTo] = useState<string>('')
  const [sortType, setSortType] = useState<SortType>('new')
  const [activeHoldTypes, setActiveHoldTypes] = useState<string[]>([])
  const [activeStyles, setActiveStyles] = useState<string[]>([])
  const [isCampus, setIsCampus] = useState(false)
  const [hideCompleted, setHideCompleted] = useState(false)
  const [myAscentRouteIds, setMyAscentRouteIds] = useState<Set<string>>(new Set())

  // ドロップダウン
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  /* ===== 初期化 ===== */
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

        const { data: ascentsData } = await supabase
          .from('ascents')
          .select('route_id')
          .eq('user_id', user.id)
        if (ascentsData) {
          setMyAscentRouteIds(new Set(ascentsData.map((a: any) => a.route_id)))
        }
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
          }
        } catch {
          setGyms(gymsData)
        }
      }

      const { data: wallsData } = await supabase
        .from('walls')
        .select('id, gym_id, name')
        .order('name')
      if (wallsData) setWalls(wallsData)

      await fetchRoutes(initialGymId)
      setLoading(false)
    }
    init()
  }, [])

  /* ===== ドロップダウン制御 ===== */
  const filterBarRef = useRef<HTMLDivElement>(null)

  const toggleDropdown = useCallback((name: string) => {
    setActiveDropdown(prev => prev === name ? null : name)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* ===== データ取得 ===== */
  const fetchRoutes = async (gymId?: string) => {
    let query = supabase
      .from('routes_with_counts')
      .select('*')

    const targetGymId = gymId ?? selectedGymId
    if (targetGymId && targetGymId !== 'all') {
      query = query.eq('gym_id', targetGymId)
    }

    const { data } = await query
    if (data) {
      setRoutes(data as RouteWithCounts[])
      applyFilters(data as RouteWithCounts[], {
        gradeFrom, gradeTo, sortType, activeHoldTypes, activeStyles, isCampus, hideCompleted,
        wallId: selectedWallId,
      })
    }
  }

  /* ===== フィルター適用 ===== */
  type FilterParams = {
    gradeFrom: string
    gradeTo: string
    sortType: SortType
    activeHoldTypes: string[]
    activeStyles: string[]
    isCampus: boolean
    hideCompleted: boolean
    wallId: string
  }

  const applyFilters = (data: RouteWithCounts[], params: FilterParams) => {
    let result = [...data]

    if (params.gradeFrom || params.gradeTo) {
      const fromIndex = params.gradeFrom ? GRADES.indexOf(params.gradeFrom) : 0
      const toIndex = params.gradeTo ? GRADES.indexOf(params.gradeTo) : GRADES.length - 1
      result = result.filter((r) => {
        const idx = GRADES.indexOf(r.grade)
        if (idx === -1) return true
        return idx >= fromIndex && idx <= toIndex
      })
    }

    if (params.wallId && params.wallId !== 'all') {
      result = result.filter((r) => r.wall_id === params.wallId)
    }

    if (params.activeHoldTypes.length > 0) {
      result = result.filter((r) => r.hold_type && r.hold_type.some(ht => params.activeHoldTypes.includes(ht)))
    }

    if (params.activeStyles.length > 0) {
      result = result.filter((r) => {
        if (!r.style) return false
        return params.activeStyles.some(s => STYLE_LABELS[s] === r.style)
      })
    }

    if (params.isCampus) {
      result = result.filter((r) => r.tags && r.tags.includes('キャンパ課題'))
    }

    if (params.hideCompleted && myAscentRouteIds.size > 0) {
      result = result.filter((r) => !myAscentRouteIds.has(r.id))
    }

    switch (params.sortType) {
      case 'new':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'repeat':
        result.sort((a, b) => b.ascent_count - a.ascent_count)
        break
      case 'recommend':
        result.sort((a, b) => b.recommend_count - a.recommend_count)
        break
    }

    setFilteredRoutes(result)
  }

  /* ===== フィルターハンドラ ===== */
  const currentFilterParams = (): FilterParams => ({
    gradeFrom, gradeTo, sortType, activeHoldTypes, activeStyles, isCampus, hideCompleted,
    wallId: selectedWallId,
  })

  const handleGymChange = async (gymId: string) => {
    setSelectedGymId(gymId)
    setSelectedWallId('all')
    setActiveDropdown(null)
    await fetchRoutes(gymId)
  }

  const handleWallChange = (wallId: string) => {
    setSelectedWallId(wallId)
    setActiveDropdown(null)
    applyFilters(routes, { ...currentFilterParams(), wallId })
  }

  const handleGradeFromChange = (value: string) => {
    setGradeFrom(value)
    setActiveDropdown(null)
    applyFilters(routes, { ...currentFilterParams(), gradeFrom: value })
  }

  const handleGradeToChange = (value: string) => {
    setGradeTo(value)
    setActiveDropdown(null)
    applyFilters(routes, { ...currentFilterParams(), gradeTo: value })
  }

  const handleSortChange = (value: SortType) => {
    setSortType(value)
    setActiveDropdown(null)
    applyFilters(routes, { ...currentFilterParams(), sortType: value })
  }

  const toggleHoldType = (ht: string) => {
    const next = activeHoldTypes.includes(ht)
      ? activeHoldTypes.filter(h => h !== ht)
      : [...activeHoldTypes, ht]
    setActiveHoldTypes(next)
    applyFilters(routes, { ...currentFilterParams(), activeHoldTypes: next })
  }

  const toggleStyle = (s: string) => {
    const next = activeStyles.includes(s)
      ? activeStyles.filter(x => x !== s)
      : [...activeStyles, s]
    setActiveStyles(next)
    applyFilters(routes, { ...currentFilterParams(), activeStyles: next })
  }

  const toggleCampus = () => {
    const next = !isCampus
    setIsCampus(next)
    applyFilters(routes, { ...currentFilterParams(), isCampus: next })
  }

  const toggleHideCompleted = () => {
    const next = !hideCompleted
    setHideCompleted(next)
    applyFilters(routes, { ...currentFilterParams(), hideCompleted: next })
  }

  /* ===== 派生データ ===== */
  const currentWalls = selectedGymId === 'all'
    ? walls
    : walls.filter(w => w.gym_id === selectedGymId)

  const selectedGymName = selectedGymId === 'all'
    ? 'すべてのジム'
    : gyms.find(g => g.id === selectedGymId)?.name || 'ジム'

  const selectedWallName = selectedWallId === 'all'
    ? 'すべての壁'
    : currentWalls.find(w => w.id === selectedWallId)?.name || '壁'

  /* ========== ローディング ========== */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-sub text-sm tracking-wide">読み込み中...</p>
        </div>
      </div>
    )
  }

  /* ========== メインUI ========== */
  return (
    <div className="min-h-screen bg-bg pb-36">

      {/* ===== ヘッダー ===== */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border/60">
        <div className="px-4 h-12 flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary tracking-wider">カベログ</h1>
          {user ? (
            <a
              href={`/user/${user.id}`}
              className="flex items-center gap-1.5 text-xs text-text-sub hover:text-primary transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              {nickname}
            </a>
          ) : (
            <a
              href="/login"
              className="text-xs text-primary font-medium hover:text-primary-dark transition-colors"
            >
              ログイン
            </a>
          )}
        </div>
      </header>

      {/* ===== フィルターバー（2行・上部固定） ===== */}
      <div className="sticky top-12 z-40 bg-white/90 backdrop-blur-md border-b border-border/60" ref={filterBarRef}>
        <div className="px-3 pt-2.5 pb-2 space-y-2 overflow-visible">

          {/* 1行目: ジム / 壁 / グレード範囲 / ソート */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide overflow-y-visible">

            {/* ジム */}
            <div className="relative shrink-0">
              <Chip
                label={selectedGymId === 'all' ? 'ジム' : (gyms.find(g => g.id === selectedGymId)?.name || 'ジム')}
                active={selectedGymId !== 'all'}
                onClick={() => toggleDropdown('gym')}
                hasDropdown
              />
              {activeDropdown === 'gym' && (
                <Dropdown
                  items={[
                    { value: 'all', label: 'すべて' },
                    ...gyms.map(g => ({ value: g.id, label: g.name })),
                  ]}
                  selectedValue={selectedGymId}
                  onSelect={handleGymChange}
                />
              )}
            </div>

            {/* 壁 */}
            <div className="relative shrink-0">
              <Chip
                label={selectedWallId === 'all' ? '壁' : (currentWalls.find(w => w.id === selectedWallId)?.name || '壁')}
                active={selectedWallId !== 'all'}
                onClick={() => toggleDropdown('wall')}
                hasDropdown
              />
              {activeDropdown === 'wall' && (
                <Dropdown
                  items={[
                    { value: 'all', label: 'すべて' },
                    ...currentWalls.map(w => ({ value: w.id, label: w.name })),
                  ]}
                  selectedValue={selectedWallId}
                  onSelect={handleWallChange}
                />
              )}
            </div>

            {/* グレード範囲 */}
            <div className="relative shrink-0">
              <Chip
                label={gradeFrom || '5級-'}
                active={!!gradeFrom}
                onClick={() => toggleDropdown('gradeFrom')}
                hasDropdown
              />
              {activeDropdown === 'gradeFrom' && (
                <Dropdown
                  items={[
                    { value: '', label: '下限なし' },
                    ...GRADES.map(g => ({ value: g, label: g })),
                  ]}
                  selectedValue={gradeFrom}
                  onSelect={handleGradeFromChange}
                />
              )}
            </div>

            <span className="text-text-sub text-xs shrink-0">〜</span>

            <div className="relative shrink-0">
              <Chip
                label={gradeTo || '三段+'}
                active={!!gradeTo}
                onClick={() => toggleDropdown('gradeTo')}
                hasDropdown
              />
              {activeDropdown === 'gradeTo' && (
                <Dropdown
                  items={[
                    { value: '', label: '上限なし' },
                    ...GRADES.map(g => ({ value: g, label: g })),
                  ]}
                  selectedValue={gradeTo}
                  onSelect={handleGradeToChange}
                />
              )}
            </div>

            {/* ソート */}
            <div className="relative shrink-0">
              <Chip
                label={SORT_OPTIONS.find(o => o.value === sortType)?.label || '新着'}
                active={false}
                onClick={() => toggleDropdown('sort')}
                hasDropdown
              />
              {activeDropdown === 'sort' && (
                <Dropdown
                  items={SORT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  selectedValue={sortType}
                  onSelect={(v) => handleSortChange(v as SortType)}
                />
              )}
            </div>
          </div>

          {/* 2行目: ホールド / 系統 / キャンパ / 完登非表示 */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide overflow-y-visible">

            {/* ホールドタイプ */}
            <div className="relative shrink-0">
              <Chip
                label={activeHoldTypes.length > 0 ? `ホールド(${activeHoldTypes.length})` : 'ホールド'}
                active={activeHoldTypes.length > 0}
                onClick={() => toggleDropdown('holdType')}
                hasDropdown
              />
              {activeDropdown === 'holdType' && (
                <CheckDropdown
                  items={HOLD_TYPES.map(ht => ({ value: ht, label: ht }))}
                  activeItems={activeHoldTypes}
                  onToggle={toggleHoldType}
                />
              )}
            </div>

            {/* 課題系統 */}
            <div className="relative shrink-0">
              <Chip
                label={activeStyles.length > 0 ? `系統(${activeStyles.length})` : '系統'}
                active={activeStyles.length > 0}
                onClick={() => toggleDropdown('style')}
                hasDropdown
              />
              {activeDropdown === 'style' && (
                <CheckDropdown
                  items={STYLES.map(s => ({ value: s, label: STYLE_LABELS[s] }))}
                  activeItems={activeStyles}
                  onToggle={toggleStyle}
                />
              )}
            </div>

            {/* キャンパ */}
            <Chip
              label="キャンパ"
              active={isCampus}
              onClick={toggleCampus}
            />

            {/* 完登非表示 */}
            {user && (
              <Chip
                label="完登済み非表示"
                active={hideCompleted}
                onClick={toggleHideCompleted}
              />
            )}

            {/* フィルター件数 */}
            <span className="text-[10px] text-text-sub shrink-0 pl-1">
              {filteredRoutes.length}件
            </span>
          </div>
        </div>
      </div>

      {/* ===== 課題一覧（2列グリッド） ===== */}
      <main className="px-1 pt-1">
        {filteredRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E8E0D0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <p className="text-text-sub text-sm mt-4">
              {routes.length === 0 ? 'まだ課題が投稿されていません' : '条件に一致する課題がありません'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {filteredRoutes.map((route) => (
              <a
                key={route.id}
                href={`/routes/${route.id}`}
                className="group block bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {/* 画像エリア */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={route.image_url}
                    alt="課題写真"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                  {/* グレードバッジ（左上） */}
                  <div className="absolute top-2 left-2">
                    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-black/60 text-white backdrop-blur-sm">
                      {route.grade}
                    </span>
                  </div>
                  {/* お気に入り数（右上） */}
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] bg-black/40 text-white/90 backdrop-blur-sm">
                      ♡ {route.favorite_count}
                    </span>
                  </div>
                </div>

                {/* 情報エリア */}
                <div className="px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-text-main font-medium truncate">
                      {route.poster_nickname}
                    </p>
                    <span className="text-[10px] text-text-sub shrink-0 ml-1">
                      ✓{route.ascent_count}
                    </span>
                  </div>
                  {route.description && (
                    <p className="text-[10px] text-text-sub mt-0.5 truncate">
                      {route.description}
                    </p>
                  )}
                  <p className="text-[9px] text-text-sub/60 mt-1">
                    {timeAgo(route.created_at)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

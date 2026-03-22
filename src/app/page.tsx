'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
const STYLES = ['岩系', 'ショート', '長い系', 'ランジ', 'コーデ']
const STYLE_LABELS: Record<string, string> = {
  '岩系': '岩系',
  'ショート': 'ショートハード系',
  '長い系': '手数長い系',
  'ランジ': 'ランジ系',
  'コーデ': 'コーデ系',
}

type SortType = 'new' | 'repeat' | 'recommend' | 'grade_desc' | 'grade_asc'
const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'new', label: '新課題順' },
  { value: 'repeat', label: 'リピート順' },
  { value: 'recommend', label: 'おすすめ順' },
  { value: 'grade_desc', label: 'むずかしい順' },
  { value: 'grade_asc', label: 'やさしい順' },
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

/* ========== FixedDropdown コンポーネント ========== */

function FixedDropdown({
  isOpen,
  buttonRef,
  children,
}: {
  isOpen: boolean
  buttonRef: React.RefObject<HTMLButtonElement | null>
  children: React.ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)),
      })
    }
  }, [isOpen, buttonRef])

  if (!isOpen || !pos) return null

  return (
    <div
      className="fixed bg-card border border-border rounded-lg shadow-lg max-h-[100vh] overflow-y-auto min-w-[400px]"
      style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      {children}
    </div>
  )
}

/* ========== コンポーネント ========== */

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

  // ドロップダウン状態
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  // 各ドロップダウンボタンのref
  const gradeFromRef = useRef<HTMLButtonElement | null>(null)
  const gradeToRef = useRef<HTMLButtonElement | null>(null)
  const sortRef = useRef<HTMLButtonElement | null>(null)
  const gymRef = useRef<HTMLButtonElement | null>(null)
  const wallRef = useRef<HTMLButtonElement | null>(null)
  const holdTypeRef = useRef<HTMLButtonElement | null>(null)
  const styleRef = useRef<HTMLButtonElement | null>(null)

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

        // 自分の完登済み課題IDを取得
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
  const toggleDropdown = useCallback((name: string) => {
    setActiveDropdown(prev => prev === name ? null : name)
  }, [])

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (activeDropdown) {
        const target = e.target as HTMLElement
        if (target.closest('[data-dropdown-menu]')) return
        if (target.closest('[data-dropdown-button]')) return
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [activeDropdown])

  // スクロール時にドロップダウンを閉じる
  useEffect(() => {
    if (!activeDropdown) return
    const handleScroll = () => setActiveDropdown(null)
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [activeDropdown])

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
      case 'grade_desc':
        result.sort((a, b) => {
          const idxA = GRADES.indexOf(a.grade)
          const idxB = GRADES.indexOf(b.grade)
          return (idxB === -1 ? -1 : idxB) - (idxA === -1 ? -1 : idxA)
        })
        break
      case 'grade_asc':
        result.sort((a, b) => {
          const idxA = GRADES.indexOf(a.grade)
          const idxB = GRADES.indexOf(b.grade)
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB)
        })
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

  /* ===== 現在のジムの壁リスト ===== */
  const currentWalls = selectedGymId === 'all'
    ? walls
    : walls.filter(w => w.gym_id === selectedGymId)

  const selectedGymName = selectedGymId === 'all'
    ? 'ジム'
    : gyms.find(g => g.id === selectedGymId)?.name || 'ジム'

  const selectedWallName = selectedWallId === 'all'
    ? '壁'
    : currentWalls.find(w => w.id === selectedWallId)?.name || '壁'

  /* ===== ドロップダウンの選択肢スタイル ===== */
  const dropdownItemClass = (isActive: boolean) =>
    `block w-full px-8 py-6 text-5xl text-left hover:bg-primary-light whitespace-nowrap ${
      isActive ? 'bg-primary-light text-primary font-bold' : ''
  }`

  const checkboxItemClass = (isActive: boolean) =>
    `flex items-center gap-4 w-full px-8 py-6 text-5xl text-left hover:bg-primary-light whitespace-nowrap ${
      isActive ? 'text-primary font-bold' : ''
  }`

  /* ========== ローディング ========== */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-text-sub text-2xl">読み込み中...</p>
        </div>
      </div>
    )
  }

  /* ===== フィルターボタン共通スタイル ===== */
  const filterBtnBase = 'px-7 py-4 rounded-full text-3xl font-medium border transition-colors whitespace-nowrap'
  const filterBtnActive = 'bg-primary text-white border-primary'
  const filterBtnInactive = 'bg-primary-light text-text-main border-border hover:border-primary'

  /* ========== メインUI ========== */
  return (
    <div className="min-h-screen bg-bg overflow-hidden" style={{ paddingBottom: '160px' }}>
      {/* ===== ヘッダー ===== */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="w-full px-4 h-12 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary tracking-wide">カベログ</h1>
          {user ? (
            <Link
              href={`/user/${user.id}`}
              className="text-2xl text-text-sub hover:text-primary transition-colors"
            >
              {nickname}
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-2xl text-primary font-medium hover:text-primary-dark transition-colors"
            >
              ログイン
            </Link>
          )}
        </div>
      </header>

      {/* ===== フィルターバー（横スクロール） ===== */}
      <div className="sticky top-14 z-40 bg-card border-b border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* グレードFrom */}
          <button
            ref={gradeFromRef}
            data-dropdown-button
            onClick={() => toggleDropdown('gradeFrom')}
            className={`shrink-0 ${filterBtnBase} ${
              gradeFrom ? filterBtnActive : filterBtnInactive
            }`}
          >
            {gradeFrom || '5級-'}
          </button>

          <span className="text-text-sub text-3xl shrink-0">〜</span>

          {/* グレードTo */}
          <button
            ref={gradeToRef}
            data-dropdown-button
            onClick={() => toggleDropdown('gradeTo')}
            className={`shrink-0 ${filterBtnBase} ${
              gradeTo ? filterBtnActive : filterBtnInactive
            }`}
          >
            {gradeTo || '三段+'}
          </button>

          {/* ソート */}
          <button
            ref={sortRef}
            data-dropdown-button
            onClick={() => toggleDropdown('sort')}
            className={`shrink-0 ${filterBtnBase} ${filterBtnInactive}`}
          >
            {SORT_OPTIONS.find(o => o.value === sortType)?.label} ▼
          </button>

          {/* ジム */}
          <button
            ref={gymRef}
            data-dropdown-button
            onClick={() => toggleDropdown('gym')}
            className={`shrink-0 ${filterBtnBase} ${
              selectedGymId !== 'all' ? filterBtnActive : filterBtnInactive
            }`}
          >
            {selectedGymName} ▼
          </button>

          {/* 壁 */}
          <button
            ref={wallRef}
            data-dropdown-button
            onClick={() => toggleDropdown('wall')}
            className={`shrink-0 ${filterBtnBase} ${
              selectedWallId !== 'all' ? filterBtnActive : filterBtnInactive
            }`}
          >
            {selectedWallName} ▼
          </button>

          {/* ホールド */}
          <button
            ref={holdTypeRef}
            data-dropdown-button
            onClick={() => toggleDropdown('holdType')}
            className={`shrink-0 ${filterBtnBase} ${
              activeHoldTypes.length > 0 ? filterBtnActive : filterBtnInactive
            }`}
          >
            ホールド ▼
          </button>

          {/* 系統 */}
          <button
            ref={styleRef}
            data-dropdown-button
            onClick={() => toggleDropdown('style')}
            className={`shrink-0 ${filterBtnBase} ${
              activeStyles.length > 0 ? filterBtnActive : filterBtnInactive
            }`}
          >
            系統 ▼
          </button>

          {/* キャンパ */}
          <button
            onClick={() => toggleCampus()}
            className={`shrink-0 ${filterBtnBase} ${
              isCampus ? filterBtnActive : filterBtnInactive
            }`}
          >
            キャンパ
          </button>

          {/* 完登非表示（ログイン時のみ） */}
          {user && (
            <button
              onClick={() => toggleHideCompleted()}
              className={`shrink-0 ${filterBtnBase} ${
                hideCompleted ? filterBtnActive : filterBtnInactive
              }`}
            >
              完登非表示
            </button>
          )}
        </div>
      </div>

      {/* ===== Fixed ドロップダウンメニュー群 ===== */}

      {/* グレードFrom */}
      <FixedDropdown isOpen={activeDropdown === 'gradeFrom'} buttonRef={gradeFromRef}>
        <div data-dropdown-menu>
          <button onClick={() => handleGradeFromChange('')} className={dropdownItemClass(!gradeFrom)}>
            下限なし
          </button>
          {GRADES.map(g => (
            <button key={g} onClick={() => handleGradeFromChange(g)} className={dropdownItemClass(gradeFrom === g)}>
              {g}
            </button>
          ))}
        </div>
      </FixedDropdown>

      {/* グレードTo */}
      <FixedDropdown isOpen={activeDropdown === 'gradeTo'} buttonRef={gradeToRef}>
        <div data-dropdown-menu>
          <button onClick={() => handleGradeToChange('')} className={dropdownItemClass(!gradeTo)}>
            上限なし
          </button>
          {GRADES.map(g => (
            <button key={g} onClick={() => handleGradeToChange(g)} className={dropdownItemClass(gradeTo === g)}>
              {g}
            </button>
          ))}
        </div>
      </FixedDropdown>

      {/* ソート */}
      <FixedDropdown isOpen={activeDropdown === 'sort'} buttonRef={sortRef}>
        <div data-dropdown-menu>
          {SORT_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => handleSortChange(opt.value)} className={dropdownItemClass(sortType === opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      </FixedDropdown>

      {/* ジム */}
      <FixedDropdown isOpen={activeDropdown === 'gym'} buttonRef={gymRef}>
        <div data-dropdown-menu>
          <button onClick={() => handleGymChange('all')} className={dropdownItemClass(selectedGymId === 'all')}>
            すべて
          </button>
          {gyms.map(gym => (
            <button key={gym.id} onClick={() => handleGymChange(gym.id)} className={dropdownItemClass(selectedGymId === gym.id)}>
              {gym.name}
            </button>
          ))}
        </div>
      </FixedDropdown>

      {/* 壁 */}
      <FixedDropdown isOpen={activeDropdown === 'wall'} buttonRef={wallRef}>
        <div data-dropdown-menu>
          <button onClick={() => handleWallChange('all')} className={dropdownItemClass(selectedWallId === 'all')}>
            すべて
          </button>
          {currentWalls.map(wall => (
            <button key={wall.id} onClick={() => handleWallChange(wall.id)} className={dropdownItemClass(selectedWallId === wall.id)}>
              {wall.name}
            </button>
          ))}
        </div>
      </FixedDropdown>

      {/* ホールドタイプ */}
      <FixedDropdown isOpen={activeDropdown === 'holdType'} buttonRef={holdTypeRef}>
        <div data-dropdown-menu>
          {HOLD_TYPES.map(ht => (
            <button key={ht} onClick={() => toggleHoldType(ht)} className={checkboxItemClass(activeHoldTypes.includes(ht))}>
              <span className={`w-8 h-8 rounded border flex items-center justify-center text-lg ${
                activeHoldTypes.includes(ht)
                  ? 'bg-primary border-primary text-white'
                  : 'border-border bg-white'
              }`}>
                {activeHoldTypes.includes(ht) && '✓'}
              </span>
              {ht}
            </button>
          ))}
        </div>
      </FixedDropdown>

      {/* 課題系統 */}
      <FixedDropdown isOpen={activeDropdown === 'style'} buttonRef={styleRef}>
        <div data-dropdown-menu>
          {STYLES.map(s => (
            <button key={s} onClick={() => toggleStyle(s)} className={checkboxItemClass(activeStyles.includes(s))}>
              <span className={`w-8 h-8 rounded border flex items-center justify-center text-lg ${
                activeStyles.includes(s)
                  ? 'bg-primary border-primary text-white'
                  : 'border-border bg-white'
              }`}>
                {activeStyles.includes(s) && '✓'}
              </span>
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
      </FixedDropdown>

      {/* ===== 課題一覧（2列グリッド） ===== */}
      <main className="w-full pt-4">
        {filteredRoutes.length === 0 ? (
          <p className="text-center text-text-sub py-12 text-2xl">
            {routes.length === 0 ? 'まだ課題が投稿されていません' : '条件に一致する課題がありません'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-[2px]">
            {filteredRoutes.map((route) => (
              <Link
                key={route.id}
                href={`/routes/${route.id}`}
                className="block bg-card overflow-hidden rounded-xl"
              >
                <div className="aspect-[3/2] overflow-hidden">
                  <img
                    src={route.image_url}
                    alt="課題写真"
                    loading="lazy"
                    className="w-full h-full object-cover object-[center_70%] rounded-xl"
                  />
                </div>
                <div className="px-3 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-3xl font-bold text-text-main shrink-0">{route.grade}</p>
                    <p className="text-2xl text-text-sub truncate">{route.poster_nickname}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-2xl text-text-sub">♡{route.favorite_count}</span>
                    <span className="text-2xl text-text-sub">✓{route.ascent_count}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'

/** Logo app: tờ khai có dấu tích, nền trắng bo góc */
export function Logo({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#fff" />
      <path d="M18 10h20l10 10v32a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" fill="#047857" />
      <path d="M38 10v8a2 2 0 0 0 2 2h8z" fill="#6ee7b7" />
      <rect x="20" y="24" width="16" height="3" rx="1.5" fill="#a7f3d0" />
      <rect x="20" y="31" width="22" height="3" rx="1.5" fill="#a7f3d0" />
      <circle cx="44" cy="46" r="11" fill="#f59e0b" stroke="#fff" strokeWidth="3" />
      <path d="M39 46.5l3.5 3.5 6.5-7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Ảnh đại diện Google; không tải được ảnh thì hiện chữ cái đầu như Gmail */
function AnhDaiDien({ user, lon }: { user: User; lon?: boolean }) {
  const [loi, setLoi] = useState(false)
  const kt = lon ? 'h-16 w-16 text-2xl' : 'h-8 w-8 text-sm'
  if (user.photoURL && !loi) {
    return <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setLoi(true)} className={`${kt} shrink-0 rounded-full object-cover ring-2 ring-white/70`} />
  }
  const chu = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase()
  return <span className={`${kt} flex shrink-0 items-center justify-center rounded-full bg-amber-500 font-semibold text-white ring-2 ring-white/70`}>{chu}</span>
}

/** Ô tài khoản góc phải: tên + email, bấm vào mở bảng có nút đăng xuất (giống Gmail) */
export function TaiKhoan({ user, onDangXuat }: { user: User; onDangXuat: () => void }) {
  const [mo, setMo] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!mo) return
    const dong = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMo(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMo(false)
    document.addEventListener('mousedown', dong)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', dong)
      document.removeEventListener('keydown', esc)
    }
  }, [mo])
  const ten = user.displayName || user.email?.split('@')[0] || 'Tài khoản Google'
  return (
    <div ref={ref} className="relative">
      <button
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 hover:bg-emerald-800 sm:pr-3"
        onClick={() => setMo(!mo)}
        aria-expanded={mo}
        title={`Tài khoản Google\n${ten}\n${user.email ?? ''}`}
      >
        <AnhDaiDien user={user} />
        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-48 truncate text-sm font-medium">{ten}</span>
          <span className="block max-w-48 truncate text-xs text-emerald-100">{user.email}</span>
        </span>
      </button>
      {mo && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-center text-slate-800 shadow-xl">
          <div className="flex justify-center"><AnhDaiDien user={user} lon /></div>
          <p className="mt-2 font-semibold">Xin chào, {ten}!</p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
          <p className="mt-2 text-xs text-slate-500">☁️ Hồ sơ đang được lưu vào tài khoản này</p>
          <button
            className="mt-3 w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            onClick={() => {
              setMo(false)
              onDangXuat()
            }}
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { taiNhatKyAI, taiPhienAI, thuHoiPhienAI, type DongNhatKyAI, type PhienAIMay } from '../may/dongBo'

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
        <div className="absolute right-0 top-full mt-2 max-h-[80vh] w-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-center text-slate-800 shadow-xl">
          <div className="flex justify-center"><AnhDaiDien user={user} lon /></div>
          <p className="mt-2 font-semibold">Xin chào, {ten}!</p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
          <p className="mt-2 text-xs text-slate-500">☁️ Hồ sơ đang được lưu vào tài khoản này</p>
          <KetNoiAI uid={user.uid} />
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

const gio = (d: Date | null) => (d ? d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

/** AI (Claude Code, Claude Desktop...) kết nối vào hồ sơ qua MCP: địa chỉ kết nối, máy đang có quyền, nhật ký AI ghi/xoá */
function KetNoiAI({ uid }: { uid: string }) {
  const [phien, setPhien] = useState<PhienAIMay[] | null>(null)
  const [nhatKy, setNhatKy] = useState<DongNhatKyAI[]>([])
  const [loi, setLoi] = useState('')
  const [daChep, setDaChep] = useState(false)
  const diaChi = `${location.origin}/mcp`
  const tai = () => {
    taiPhienAI(uid).then(setPhien).catch((e) => setLoi((e as Error).message))
    taiNhatKyAI(uid).then(setNhatKy).catch(() => undefined)
  }
  useEffect(tai, [uid])
  async function thuHoi(p: PhienAIMay) {
    if (!confirm(`Thu hồi quyền của "${p.tenMay}"? AI trên máy đó sẽ không đọc/ghi hồ sơ được nữa (muốn dùng lại thì kết nối lại).`)) return
    try {
      await thuHoiPhienAI(uid, p.id)
      tai()
    } catch (e) {
      setLoi((e as Error).message)
    }
  }
  return (
    <div className="mt-3 border-t border-slate-200 pt-3 text-left">
      <p className="text-sm font-semibold">🤖 Kết nối AI (Claude Code…)</p>
      <p className="mt-1 text-xs text-slate-500">Gõ trên máy cần dùng AI:</p>
      <button
        className="mt-1 w-full break-all rounded-lg bg-slate-100 px-2 py-1 text-left font-mono text-xs hover:bg-slate-200"
        title="Bấm để chép"
        onClick={() => {
          void navigator.clipboard?.writeText(`claude mcp add --transport http khaithue ${diaChi}`).then(() => setDaChep(true))
        }}
      >
        claude mcp add --transport http khaithue {diaChi}
      </button>
      {daChep && <p className="text-xs text-emerald-700">Đã chép lệnh.</p>}
      {loi && <p className="mt-1 text-xs text-red-700">⚠️ {loi}</p>}
      <p className="mt-2 text-xs font-medium text-slate-600">Máy đang có quyền</p>
      {phien === null ? (
        <p className="text-xs text-slate-400">Đang tải…</p>
      ) : phien.length === 0 ? (
        <p className="text-xs text-slate-400">Chưa có máy nào.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {phien.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.tenMay}</span>
                <span className="block truncate text-slate-400">{p.noiNhan} · {gio(p.taoLuc)}</span>
              </span>
              <button className="shrink-0 rounded-full border border-red-300 px-2 py-0.5 text-red-700 hover:bg-red-50" onClick={() => void thuHoi(p)}>
                Thu hồi
              </button>
            </li>
          ))}
        </ul>
      )}
      {nhatKy.length > 0 && (
        <>
          <p className="mt-2 text-xs font-medium text-slate-600">AI đã ghi / xoá gần đây</p>
          <ul className="mt-1 space-y-1">
            {nhatKy.map((d) => (
              <li key={d.id} className={`text-xs ${d.congCu === 'xoa_tai_lieu' ? 'text-red-700' : 'text-slate-600'}`}>
                <span className="text-slate-400">{gio(d.luc)} · {d.tenMay}:</span> {d.moTa}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

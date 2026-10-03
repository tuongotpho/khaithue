import { useRef, useState, type ReactNode } from 'react'
import type { CanhBao } from '../core/types'
import { tien } from '../core/nhan'

export function Buoc({ so, tieuDe, children, phai }: { so: number; tieuDe: string; children: ReactNode; phai?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-base font-bold text-white">{so}</span>
        <h2 className="text-xl font-semibold text-slate-800">{tieuDe}</h2>
        <div className="ml-auto">{phai}</div>
      </div>
      {children}
    </section>
  )
}

/** Ô nhập số tiền: hiện dấu chấm phân cách nghìn */
export function OTien({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const [dangGo, setDangGo] = useState<string | null>(null)
  return (
    <input
      inputMode="numeric"
      disabled={disabled}
      className="w-28 sm:w-40 rounded-lg border border-slate-300 px-2 py-1 text-right tabular-nums focus:border-emerald-500 focus:outline-none disabled:bg-slate-100"
      value={dangGo ?? tien(value)}
      onFocus={() => setDangGo(value ? String(value) : '')}
      onChange={(e) => {
        const s = e.target.value.replace(/[^\d-]/g, '')
        setDangGo(s)
        onChange(Number(s) || 0)
      }}
      onBlur={() => setDangGo(null)}
    />
  )
}

export function DanhSachCanhBao({ ds }: { ds: CanhBao[] }) {
  if (!ds.length) return null
  return (
    <ul className="mt-3 space-y-1">
      {ds.map((c, i) => (
        <li key={i} className={`rounded-lg px-3 py-2 text-sm ${c.muc === 'loi' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
          {c.muc === 'loi' ? '⛔ ' : '⚠️ '}
          {c.noiDung}
        </li>
      ))}
    </ul>
  )
}

export function VungThaFile({ onFiles, nhan, accept }: { onFiles: (f: File[]) => void; nhan: ReactNode; accept: string }) {
  const [keo, setKeo] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setKeo(true)
      }}
      onDragLeave={() => setKeo(false)}
      onDrop={(e) => {
        e.preventDefault()
        setKeo(false)
        onFiles([...e.dataTransfer.files])
      }}
      onClick={() => ref.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${keo ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'}`}
    >
      <input
        ref={ref}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      {nhan}
    </div>
  )
}

export function taiFile(ten: string, noiDung: string) {
  const url = URL.createObjectURL(new Blob([noiDung], { type: 'application/xml;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = ten
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

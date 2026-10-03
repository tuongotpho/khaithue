import { useState } from 'react'
import { tenKy } from '../core/kho'
import { tien } from '../core/nhan'
import { taiTep, type DuLieuMay } from '../may/dongBo'

function taiVeMay(ten: string, du: ArrayBuffer) {
  const url = URL.createObjectURL(new Blob([du]))
  const a = document.createElement('a')
  a.href = url
  a.download = ten
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Kho hồ sơ trên mây của một công ty, xếp theo quý */
export function KhoHoSo({ may, mst, onMoLai }: { may: DuLieuMay; mst: string; onMoLai: (khoa: string, tep: { ten: string; du: ArrayBuffer }[]) => void }) {
  const [ban, setBan] = useState('')
  const toKhai = may.toKhai.filter((t) => t.mst === mst)
  const hoaDon = may.tepHoaDon[mst] ?? []
  const daXuat = may.daXuat[mst] ?? []
  const cacKy = [...new Set([...toKhai.map((t) => t.ky), ...hoaDon.map((h) => h.ky), ...daXuat.map((d) => d.ky)])].filter(Boolean).sort().reverse()
  if (!cacKy.length) return <p className="text-sm text-slate-500">Chưa có hồ sơ nào trên mây cho công ty này. Kéo file vào bước 1 là app tự lưu.</p>

  async function tai(ten: string, duongDan: string) {
    setBan(duongDan)
    try {
      taiVeMay(ten, await taiTep(duongDan))
    } finally {
      setBan('')
    }
  }

  async function moLai(khoa: string) {
    setBan(khoa)
    try {
      const ds = hoaDon.filter((h) => h.ky === khoa)
      onMoLai(khoa, await Promise.all(ds.map(async (h) => ({ ten: h.ten, du: await taiTep(h.duongDan) }))))
    } finally {
      setBan('')
    }
  }

  return (
    <div className="space-y-3">
      {cacKy.map((khoa) => {
        const tk = toKhai.filter((t) => t.ky === khoa).sort((a, b) => a.maTKhai.localeCompare(b.maTKhai) || a.soLan - b.soLan)
        const hd = hoaDon.filter((h) => h.ky === khoa)
        const xu = daXuat.filter((d) => d.ky === khoa)
        return (
          <div key={khoa} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <b className="text-lg">Quý {tenKy(khoa)}</b>
              {hd.length > 0 && (
                <button disabled={!!ban} onClick={() => moLai(khoa)} className="rounded-lg bg-emerald-600 px-3 py-1 text-sm text-white disabled:bg-slate-300">
                  {ban === khoa ? 'Đang tải…' : `Mở lại quý này (${hd.length} file hoá đơn)`}
                </button>
              )}
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {tk.map((t) => (
                <li key={t.id} className={t.khongChapNhan ? 'text-slate-400 line-through' : ''}>
                  📄 {t.maTKhai === '842' ? '01/GTGT' : '05/KK-TNCN'} {t.loaiTKhai === 'B' ? `bổ sung ${t.soLan}` : 'lần đầu'}
                  {t.maTKhai === '842' && <> — [40] {tien(t.ct.ct40 ?? 0)} · [43] {tien(t.ct.ct43 ?? 0)}</>}
                  {t.khongChapNhan && ' (CQT trả về)'}{' '}
                  <button className="text-emerald-700 underline" disabled={!!ban} onClick={() => tai(t.tenFile, t.duongDan)}>tải XML</button>
                </li>
              ))}
              {hd.map((h) => (
                <li key={h.id}>
                  📊 {h.ten} — {[h.soBan && `bán ${h.soBan}`, h.soMua && `mua ${h.soMua}`].filter(Boolean).join(', ')} HĐ{' '}
                  <button className="text-emerald-700 underline" disabled={!!ban} onClick={() => tai(h.ten, h.duongDan)}>tải</button>
                </li>
              ))}
              {xu.map((x) => (
                <li key={x.id} className="text-slate-600">
                  ⬆ App đã xuất: {x.tenFile}{x.ct40 !== null && <> — [40] {tien(x.ct40)}</>}{' '}
                  <button className="text-emerald-700 underline" disabled={!!ban} onClick={() => tai(x.tenFile, x.duongDan)}>tải</button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

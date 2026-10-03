import type { KetQuaPhanLoai } from '../core/excel'
import type { LoaiHD } from '../core/types'

export interface NhatKy {
  ten: string
  moTa: string
  loi?: boolean
}

/** Danh sách file đã nạp. File Excel: hiện app đã nhận ra bao nhiêu HĐ bán/mua, cho đổi nếu nhận sai. */
export function DanhSachTep({
  nhatKy, pl, epBuoc, setEpBuoc, tenExcel,
}: {
  nhatKy: NhatKy[]
  pl: KetQuaPhanLoai
  epBuoc: Record<string, LoaiHD>
  setEpBuoc: (e: Record<string, LoaiHD>) => void
  tenExcel: string[]
}) {
  if (!nhatKy.length && !tenExcel.length) return null
  const doi = (ten: string) => {
    const hien = epBuoc[ten]
    const e = { ...epBuoc }
    if (!hien) e[ten] = 'ban'
    else if (hien === 'ban') e[ten] = 'mua'
    else delete e[ten]
    setEpBuoc(e)
  }
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {nhatKy.map((f, i) => (
        <li key={'x' + i} className={f.loi ? 'text-slate-400' : ''}>📄 {f.ten} — {f.moTa}</li>
      ))}
      {tenExcel.map((ten) => {
        const d = pl.theoTep[ten]
        if (!d) return null
        const nhan = [d.ban && `Bán ra ${d.ban}`, d.mua && `Mua vào ${d.mua}`, d.khac && `không liên quan ${d.khac}`].filter(Boolean).join(' · ') || 'không có hoá đơn'
        return (
          <li key={ten} className="flex flex-wrap items-center gap-2">
            <span>📊 {ten.replace(/#sheet 1$/i, '')} — {nhan}</span>
            <span className={`text-xs ${d.epBuoc ? 'text-amber-700' : 'text-slate-400'}`}>{d.epBuoc ? '(chọn tay)' : '(tự nhận)'}</span>
            <button className="text-xs text-emerald-700 underline" onClick={() => doi(ten)} title="Bấm lần lượt: ép cả file là Bán ra → ép Mua vào → trả về tự nhận">
              {!epBuoc[ten] ? 'Nhận sai? Đổi thành Bán ra' : epBuoc[ten] === 'ban' ? 'Đổi thành Mua vào' : 'Trả về tự nhận'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

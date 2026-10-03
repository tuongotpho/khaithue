import type { tinhGTGT, SuaPhuLucMua } from '../core/gtgt'
import { tien } from '../core/nhan'
import type { HoaDon } from '../core/types'
import { OTien } from './chung'

export function TheTong({ ten, ds }: { ten: string; ds: HoaDon[] }) {
  const v = ds.reduce((s, h) => s + h.chuaThue, 0)
  const t = ds.reduce((s, h) => s + h.thue, 0)
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="font-semibold">{ten}: {ds.length} hoá đơn</div>
      <div className="text-sm text-slate-600">Chưa thuế <b className="tabular-nums text-slate-800">{tien(v)}</b> · Thuế <b className="tabular-nums text-slate-800">{tien(t)}</b></div>
    </div>
  )
}

export function KetLuanGTGT({ ct }: { ct: Record<string, number> }) {
  if (ct.ct40 > 0)
    return <div className="rounded-xl bg-red-50 p-4 text-lg text-red-900">Thuế GTGT <b>phải nộp</b> quý này [40]: <b className="tabular-nums">{tien(ct.ct40)} đ</b></div>
  return (
    <div className="rounded-xl bg-emerald-50 p-4 text-lg text-emerald-900">
      Không phải nộp thuế GTGT quý này. Còn được khấu trừ chuyển sang quý sau [43]: <b className="tabular-nums">{tien(ct.ct43)} đ</b>
    </div>
  )
}

export function PhuLuc({ tk, suaMua, setSuaMua }: { tk: ReturnType<typeof tinhGTGT>['toKhai']; suaMua: SuaPhuLucMua; setSuaMua: (s: SuaPhuLucMua) => void }) {
  if (!tk.plBan.length && !tk.plMua.length) return null
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold">Phụ lục giảm thuế GTGT (thuế suất 10% → 8%)</h3>
      <div className="mt-2 overflow-x-auto">
        <div className="font-medium">I. Hàng hoá, dịch vụ mua vào trong kỳ chịu thuế 8% <span className="text-sm font-normal text-slate-500">(sửa được nếu cần)</span></div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th>Người bán</th><th className="text-right">Giá trị</th><th className="text-right">Thuế GTGT</th></tr></thead>
          <tbody>
            {tk.plMua.map((d) => {
              const k = d.mst || d.ten
              return (
                <tr key={k} className={`border-b border-slate-100 ${suaMua[k] ? 'bg-amber-50' : ''}`}>
                  <td className="py-1">{d.ten}</td>
                  <td className="py-1 text-right"><OTien value={d.giaTri} onChange={(v) => setSuaMua({ ...suaMua, [k]: { giaTri: v, thue: d.thue } })} /></td>
                  <td className="py-1 text-right"><OTien value={d.thue} onChange={(v) => setSuaMua({ ...suaMua, [k]: { giaTri: d.giaTri, thue: v } })} /></td>
                </tr>
              )
            })}
            <tr className="font-semibold"><td>Cộng [06]</td><td className="text-right tabular-nums">{tien(tk.tongPlMua.giaTri)}</td><td className="text-right tabular-nums">{tien(tk.tongPlMua.thue)}</td></tr>
          </tbody>
        </table>
        {Object.keys(suaMua).length > 0 && <button className="text-sm text-emerald-700 underline" onClick={() => setSuaMua({})}>Bỏ các chỗ đã sửa tay</button>}

        <div className="mt-4 font-medium">II. Hàng hoá, dịch vụ bán ra trong kỳ</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th>Người mua</th><th className="text-right">Giá trị</th><th className="text-right">Thuế suất</th><th className="text-right">Thuế được giảm</th></tr></thead>
          <tbody>
            {tk.plBan.map((d) => (
              <tr key={d.mst || d.ten} className="border-b border-slate-100">
                <td className="py-1">{d.ten}</td>
                <td className="py-1 text-right tabular-nums">{tien(d.giaTri)}</td>
                <td className="py-1 text-right">{d.thueSuat}% → {d.thueSuatSauGiam}%</td>
                <td className="py-1 text-right tabular-nums">{tien(d.thueGiam)}</td>
              </tr>
            ))}
            <tr className="font-semibold"><td>Cộng [08]</td><td className="text-right tabular-nums">{tien(tk.tongPlBan.giaTri)}</td><td /><td className="text-right tabular-nums">{tien(tk.tongPlBan.thueGiam)}</td></tr>
          </tbody>
        </table>
        <div className="mt-2 font-medium">III. Chênh lệch [09] = [08] − [06]: <span className="tabular-nums">{tien(tk.ct9)}</span></div>
      </div>
    </div>
  )
}

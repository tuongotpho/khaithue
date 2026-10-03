import { useState } from 'react'
import type { GopHoaDon } from '../core/excel'
import type { HoaDon } from '../core/types'
import { tien } from '../core/nhan'

export const khoaHD = (h: HoaDon) => `${h.loai}|${h.mstBan}|${h.kyHieu}|${h.so}`

type Tab = 'ban' | 'mua' | 'ngoaiKy' | 'boQua'

/** Danh sách hoá đơn, có ô tích để bỏ/thêm từng hoá đơn vào tờ khai */
export function BangHoaDon({ gop, chon, setChon }: { gop: GopHoaDon; chon: Record<string, boolean>; setChon: (c: Record<string, boolean>) => void }) {
  const [mo, setMo] = useState(false)
  const [tab, setTab] = useState<Tab>(gop.ngoaiKy.length ? 'ngoaiKy' : 'ban')
  const TABS: [Tab, string, HoaDon[]][] = [
    ['ban', 'Bán ra', gop.ban],
    ['mua', 'Mua vào', gop.mua],
    ['ngoaiKy', 'Ngoài quý', gop.ngoaiKy],
    ['boQua', 'Bị thay thế/huỷ', gop.boQua],
  ]
  const ds = TABS.find((t) => t[0] === tab)![2]
  const macDinh = tab === 'ban' || tab === 'mua'

  return (
    <div className="mt-3">
      <button className="text-emerald-700 underline" onClick={() => setMo(!mo)}>
        {mo ? 'Ẩn' : 'Xem'} danh sách hoá đơn {gop.ngoaiKy.length > 0 && !mo && '(có hoá đơn ngoài quý cần xem)'}
      </button>
      {mo && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {TABS.map(([k, ten, d]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1 text-sm ${tab === k ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}>
                {ten} ({d.length})
              </button>
            ))}
          </div>
          {tab === 'ngoaiKy' && <p className="mt-2 text-sm text-amber-800">Hoá đơn có ngày lập ngoài quý đang khai. Chỉ tích nếu chắc chắn phải kê vào quý này.</p>}
          {tab === 'boQua' && <p className="mt-2 text-sm text-slate-600">Hoá đơn đã bị thay thế hoặc huỷ — không bao giờ được tính (hoá đơn thay thế cho nó đã nằm trong danh sách).</p>}
          {tab === 'mua' && <p className="mt-2 text-sm text-slate-600">Bỏ tích hoá đơn không đủ điều kiện khấu trừ (ví dụ: từ 5 triệu trở lên mà trả tiền mặt).</p>}
          <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  {tab !== 'boQua' && <th className="p-1">Tính</th>}
                  <th className="p-1">Số HĐ</th>
                  <th className="p-1">Ngày</th>
                  <th className="p-1">{tab === 'ban' ? 'Người mua' : 'Người bán / mua'}</th>
                  <th className="p-1 text-right">Chưa thuế</th>
                  <th className="p-1 text-right">Thuế</th>
                </tr>
              </thead>
              <tbody>
                {ds.map((h) => {
                  const k = khoaHD(h)
                  const tinh = chon[k] ?? macDinh
                  return (
                    <tr key={k} className={`border-t border-slate-100 ${tab !== 'boQua' && !tinh ? 'text-slate-400 line-through' : ''}`}>
                      {tab !== 'boQua' && (
                        <td className="p-1">
                          <input type="checkbox" checked={tinh} onChange={(e) => setChon({ ...chon, [k]: e.target.checked })} />
                        </td>
                      )}
                      <td className="p-1 whitespace-nowrap">{h.kyHieu}-{h.so}</td>
                      <td className="p-1 whitespace-nowrap">{h.ngay}</td>
                      <td className="p-1">{h.loai === 'ban' ? h.tenMua : h.tenBan}</td>
                      <td className="p-1 text-right tabular-nums">{tien(h.chuaThue)}</td>
                      <td className="p-1 text-right tabular-nums">{tien(h.thue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import type { HoSoDN } from '../core/types'

const TRUONG: [keyof HoSoDN, string, boolean][] = [
  ['mst', 'Mã số thuế', true],
  ['tenNNT', 'Tên doanh nghiệp', true],
  ['dchiNNT', 'Địa chỉ', true],
  ['phuongXa', 'Phường/xã', false],
  ['maXaNNT', 'Mã phường/xã (dùng cho tờ khai TNCN)', false],
  ['maTinhNNT', 'Mã tỉnh', true],
  ['tenTinhNNT', 'Tên tỉnh', true],
  ['dthoaiNNT', 'Điện thoại', false],
  ['emailNNT', 'Email', false],
  ['maCQTNoiNop', 'Mã cơ quan thuế nơi nộp', true],
  ['tenCQTNoiNop', 'Tên cơ quan thuế nơi nộp', true],
  ['nguoiKy', 'Người ký tờ khai', true],
]

const TRONG: HoSoDN = {
  mst: '', tenNNT: '', dchiNNT: '', phuongXa: '', maXaNNT: '', maTinhNNT: '', tenTinhNNT: '',
  dthoaiNNT: '', emailNNT: '', maCQTNoiNop: '', tenCQTNoiNop: '', nguoiKy: '',
}

export function FormHoSo({ giaTri, onLuu, onHuy }: { giaTri: HoSoDN | null; onLuu: (h: HoSoDN) => void; onHuy?: () => void }) {
  const [h, setH] = useState<HoSoDN>(giaTri ?? TRONG)
  const thieu = TRUONG.filter(([k, , bat]) => bat && !h[k].trim()).map(([, ten]) => ten)
  const mstSai = h.mst && !/^\d{10}(\d{3})?$/.test(h.mst.trim())
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {TRUONG.map(([k, ten, bat]) => (
          <label key={k} className="text-sm">
            <span className="text-slate-600">{ten}{bat && <span className="text-red-600"> *</span>}</span>
            <input
              className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-base focus:border-emerald-500 focus:outline-none"
              value={h[k]}
              onChange={(e) => setH({ ...h, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {mstSai && <p className="mt-2 text-sm text-red-700">Mã số thuế phải có 10 hoặc 13 chữ số.</p>}
      <div className="mt-3 flex gap-3">
        <button
          disabled={thieu.length > 0 || !!mstSai}
          onClick={() => onLuu(Object.fromEntries(Object.entries(h).map(([k, v]) => [k, v.trim()])) as unknown as HoSoDN)}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:bg-slate-300"
        >
          Lưu
        </button>
        {onHuy && <button onClick={onHuy} className="rounded-lg border border-slate-300 px-4 py-2">Huỷ</button>}
        {thieu.length > 0 && <span className="self-center text-sm text-slate-500">Còn thiếu: {thieu.join(', ')}</span>}
      </div>
    </div>
  )
}

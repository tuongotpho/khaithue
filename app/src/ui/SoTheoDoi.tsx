import { soCai, tenKy, type Kho } from '../core/kho'
import { tien } from '../core/nhan'

/** Bảng các quý đã nạp + kiểm chuỗi đầu kỳ – cuối kỳ */
export function SoTheoDoi({ kho, mst, onKhongChapNhan }: { kho: Kho; mst: string; onKhongChapNhan: (khoa: string, i: number, gt: boolean) => void }) {
  const dong = soCai(kho, mst)
  if (!dong.length) return <p className="text-sm text-slate-500">Chưa nạp tờ khai 01/GTGT nào của công ty này.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="p-1">Quý</th>
            <th className="p-1">Bản</th>
            <th className="p-1 text-right">[22]</th>
            <th className="p-1 text-right">[40] nộp</th>
            <th className="p-1 text-right">[43]</th>
            <th className="p-1">Đầu kỳ = cuối kỳ trước?</th>
            <th className="p-1" title="Đánh dấu nếu cơ quan thuế gửi thông báo không chấp nhận bản này">CQT trả về</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((d) =>
            d.ds.map((pb, i) => (
              <tr key={d.khoa + i} className={`border-t border-slate-100 ${pb.khongChapNhan ? 'text-slate-400 line-through' : ''}`}>
                {i === 0 && <td className="p-1 font-medium" rowSpan={d.ds.length}>{tenKy(d.khoa)}</td>}
                <td className="p-1" title={pb.tenFile}>
                  {pb.loaiTKhai === 'B' ? `Bổ sung ${pb.soLan}` : 'Lần đầu'}
                  {pb.nguon === 'app' && <span className="ml-1 text-xs text-amber-700">(app xuất)</span>}
                </td>
                <td className="p-1 text-right tabular-nums">{tien(pb.ct22)}</td>
                <td className="p-1 text-right tabular-nums">{tien(pb.ct40)}</td>
                <td className="p-1 text-right tabular-nums">{tien(pb.ct43)}</td>
                {i === 0 && (
                  <td className="p-1" rowSpan={d.ds.length}>
                    {d.khop === null ? <span className="text-slate-400">— thiếu quý trước</span> : d.khop ? <span className="text-emerald-700">✅ khớp</span> : <b className="text-red-700">⛔ lệch</b>}
                  </td>
                )}
                <td className="p-1 text-center">
                  {pb.nguon === 'xml' && <input type="checkbox" checked={!!pb.khongChapNhan} onChange={(e) => onKhongChapNhan(d.khoa, i, e.target.checked)} />}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-slate-500">
        Quy tắc cơ quan thuế: [22] quý này phải bằng [43] trên tờ khai <b>lần đầu</b> của quý liền trước. Bản nào bị cơ quan thuế không chấp nhận thì tích ô “CQT trả về” để app không dùng số của bản đó.
      </p>
    </div>
  )
}

import { useMemo, useRef, useState } from 'react'
import { tenKy } from '../core/kho'
import { tien } from '../core/nhan'
import { tenTieuMuc } from '../core/taiLieu'
import type { DongQuy, TongQuan as TQ } from '../core/tongQuan'
import { DanhSachCanhBao } from './chung'

const trieu = (n: number) => (Math.abs(n) >= 1e9 ? `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ` : `${Math.round(n / 1e6).toLocaleString('vi-VN')} tr`)

/** Ô nạp hàng loạt: chọn nhiều file hoặc cả thư mục */
export function NapHangLoat({ onFiles, tienDo }: { onFiles: (f: File[]) => void; tienDo: { xong: number; tong: number; dangLam: string } | null }) {
  const tepRef = useRef<HTMLInputElement>(null)
  const thuMucRef = useRef<HTMLInputElement>(null)
  const [keo, setKeo] = useState(false)
  const nhan = (ds: FileList | null) => {
    const loc = [...(ds ?? [])].filter((f) => /\.(xml|xlsx|xls|csv)$/i.test(f.name))
    if (loc.length) onFiles(loc)
  }
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
        nhan(e.dataTransfer.files)
      }}
      className={`rounded-xl border-2 border-dashed p-5 text-center ${keo ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300'}`}
    >
      <input ref={tepRef} type="file" multiple accept=".xml,.xlsx,.xls,.csv" className="hidden" onChange={(e) => { nhan(e.target.files); e.target.value = '' }} />
      {/* @ts-expect-error webkitdirectory: chọn cả thư mục (Chrome, Edge) */}
      <input ref={thuMucRef} type="file" webkitdirectory="" multiple className="hidden" onChange={(e) => { nhan(e.target.files); e.target.value = '' }} />
      <div className="text-lg font-medium">Nạp toàn bộ hồ sơ thuế</div>
      <p className="mt-1 text-sm text-slate-600">
        Tờ khai XML (mọi mẫu), chứng từ nộp tiền XML, hoá đơn XML, Excel “Danh sách hóa đơn” — từ năm thành lập đến nay. Kéo thả vào đây, hoặc:
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <button disabled={!!tienDo} onClick={() => thuMucRef.current?.click()} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:bg-slate-300">Chọn cả thư mục</button>
        <button disabled={!!tienDo} onClick={() => tepRef.current?.click()} className="rounded-lg border border-emerald-600 px-4 py-2 font-medium text-emerald-700 disabled:opacity-50">Chọn file</button>
      </div>
      {tienDo && (
        <div className="mx-auto mt-3 max-w-md text-left">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${(100 * tienDo.xong) / Math.max(tienDo.tong, 1)}%` }} />
          </div>
          <div className="mt-1 text-sm text-slate-600">Đang xử lý {tienDo.xong}/{tienDo.tong}: {tienDo.dangLam}</div>
        </div>
      )}
    </div>
  )
}

function The({ nhan, giaTri, phu }: { nhan: string; giaTri: string; phu?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-sm text-slate-500">{nhan}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-900 sm:text-2xl">{giaTri}</div>
      {phu && <div className="text-xs text-slate-500">{phu}</div>}
    </div>
  )
}

/** Cột đôi theo quý: doanh thu (xanh) và mua vào (cam), từ tờ khai 01/GTGT */
function BieuDoQuy({ quy }: { quy: DongQuy[] }) {
  const [chon, setChon] = useState<number | null>(null)
  const ds = [...quy].reverse().slice(-12)
  const max = Math.max(1, ...ds.flatMap((q) => [q.hieuLuc?.ct34 ?? 0, q.hieuLuc?.ct23 ?? 0]))
  const W = 720, H = 220, L = 8, B = 28, T = 10
  const nhom = (W - L * 2) / Math.max(ds.length, 1)
  const cot = Math.min(22, (nhom - 10) / 2)
  const y = (v: number) => H - B - ((H - B - T) * v) / max
  const cotBo = (x: number, v: number) => {
    const top = y(v), h = H - B - top
    if (h <= 0) return ''
    const r = Math.min(4, h, cot / 2)
    return `M${x},${H - B} V${top + r} Q${x},${top} ${x + r},${top} H${x + cot - r} Q${x + cot},${top} ${x + cot},${top + r} V${H - B} Z`
  }
  const q = chon !== null ? ds[chon] : null
  return (
    <div className="viz-root">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <span className="font-medium text-slate-800">Doanh thu và mua vào theo quý (theo tờ khai 01/GTGT)</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--series-1)' }} /> Doanh thu [34]</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--series-2)' }} /> Mua vào [23]</span>
      </div>
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Biểu đồ doanh thu và mua vào theo quý">
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line x1={L} x2={W - L} y1={y(max * p)} y2={y(max * p)} stroke="#e7e5e4" strokeWidth={1} />
              <text x={W - L} y={y(max * p) - 3} textAnchor="end" fontSize={10} fill="#78716c">{trieu(max * p)}</text>
            </g>
          ))}
          <line x1={L} x2={W - L} y1={H - B} y2={H - B} stroke="#a8a29e" strokeWidth={1} />
          {ds.map((d, i) => {
            const x0 = L + i * nhom + (nhom - cot * 2 - 2) / 2
            return (
              <g key={d.khoa} onMouseEnter={() => setChon(i)} onMouseLeave={() => setChon(null)} onClick={() => setChon(i)}>
                <rect x={L + i * nhom} y={T} width={nhom} height={H - B - T} fill={chon === i ? '#f5f5f4' : 'transparent'} />
                {d.hieuLuc ? (
                  <>
                    <path d={cotBo(x0, d.hieuLuc.ct34 ?? 0)} fill="var(--series-1)" />
                    <path d={cotBo(x0 + cot + 2, d.hieuLuc.ct23 ?? 0)} fill="var(--series-2)" />
                  </>
                ) : (
                  <text x={L + i * nhom + nhom / 2} y={H - B - 6} textAnchor="middle" fontSize={10} fill="#b91c1c">thiếu TK</text>
                )}
                <text x={L + i * nhom + nhom / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="#57534e">{tenKy(d.khoa).replace('/20', '/')}</text>
              </g>
            )
          })}
        </svg>
        {q && (
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow">
            <b>Quý {tenKy(q.khoa)}</b>
            {q.hieuLuc ? (
              <>
                <div>Doanh thu: <b className="tabular-nums">{tien(q.hieuLuc.ct34 ?? 0)}</b></div>
                <div>Mua vào: <b className="tabular-nums">{tien(q.hieuLuc.ct23 ?? 0)}</b></div>
                <div>Thuế phải nộp: <b className="tabular-nums">{tien(q.hieuLuc.ct40)}</b></div>
              </>
            ) : <div className="text-red-700">Chưa có tờ khai</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function OTrangThai({ q }: { q: DongQuy }) {
  if (q.biTraVe) return <span className="text-red-700">⛔ bị trả về</span>
  if (!q.hieuLuc) return q.quaHan ? <span className="text-red-700">⛔ thiếu</span> : <span className="text-slate-400">chưa đến hạn</span>
  return (
    <span className="text-emerald-700">
      ✅ {q.coBoSung ? 'có bổ sung' : 'lần đầu'}
      {q.hieuLuc.nguon === 'app' && <span className="text-amber-700"> (app xuất)</span>}
    </span>
  )
}

export function TongQuanDN({ tq, tenCty, onMoQuy }: { tq: TQ; tenCty: string; onMoQuy: (khoa: string) => void }) {
  const cacNam = tq.nam.map((n) => n.nam)
  const [nam, setNam] = useState<number | null>(null)
  // Mặc định: năm gần nhất có tờ khai
  const namMacDinh = tq.nam.find((x) => x.soQuyCoToKhai > 0)?.nam ?? cacNam[0]
  const n = tq.nam.find((x) => x.nam === (nam ?? namMacDinh))
  const loi = useMemo(() => tq.canhBao.filter((c) => c.muc === 'loi').length, [tq])

  if (!tq.quy.length) return <p className="text-slate-500">Chưa có hồ sơ nào của {tenCty}. Nạp các file tờ khai, chứng từ, hoá đơn ở ô trên.</p>

  return (
    <div className="space-y-5">
      {/* Hạn nộp + năm */}
      <div className="flex flex-wrap items-center gap-3">
        {tq.hanToi && (
          <span className={`rounded-full px-3 py-1 ${tq.hanToi.daCoToKhai ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
            Quý {tenKy(tq.hanToi.khoa)}: hạn nộp <b>{tq.hanToi.han}</b> {tq.hanToi.daCoToKhai ? '— đã có tờ khai ✅' : tq.hanToi.conNgay >= 0 ? `— còn ${tq.hanToi.conNgay} ngày` : '— ĐÃ QUÁ HẠN'}
          </span>
        )}
        <span className="text-sm text-slate-500">Hồ sơ từ quý {tq.tuQuy ? tenKy(tq.tuQuy) : '—'}</span>
        <label className="ml-auto text-sm">
          Năm{' '}
          <select className="rounded-lg border border-slate-300 px-2 py-1" value={n?.nam} onChange={(e) => setNam(Number(e.target.value))}>
            {cacNam.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>

      {n && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <The nhan={`Doanh thu ${n.nam}`} giaTri={trieu(n.doanhThu)} phu={`${tien(n.doanhThu)} đ`} />
          <The nhan={`Mua vào ${n.nam}`} giaTri={trieu(n.muaVao)} phu={`${tien(n.muaVao)} đ`} />
          <The nhan="Thuế GTGT phải nộp" giaTri={`${tien(n.phaiNop)} đ`} phu={`${n.soQuyCoToKhai}/4 quý đã có tờ khai`} />
          <The nhan="Đã nộp (theo chứng từ)" giaTri={`${tien(n.daNop)} đ`} phu={n.daNop >= n.phaiNop ? 'đủ' : `chênh ${tien(n.phaiNop - n.daNop)} đ`} />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <BieuDoQuy quy={tq.quy} />
      </div>

      <div>
        <h3 className="font-semibold">Cần xử lý {loi > 0 && <span className="text-red-700">({loi} lỗi)</span>}</h3>
        {tq.canhBao.length ? <DanhSachCanhBao ds={tq.canhBao} /> : <p className="text-emerald-700">✅ Không có gì cần xử lý.</p>}
      </div>

      <div>
        <h3 className="mb-1 font-semibold">Theo dõi từng quý</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-2">Quý</th>
                <th className="p-2">01/GTGT</th>
                <th className="p-2">TNCN</th>
                <th className="p-2 text-right">Doanh thu (tờ khai)</th>
                <th className="p-2 text-right">HĐ bán ra</th>
                <th className="p-2 text-right">Phải nộp</th>
                <th className="p-2 text-right">Đã nộp</th>
                <th className="p-2">Đầu kỳ</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {tq.quy.map((q) => {
                const lechHD = q.hieuLuc && q.hoaDon && q.hoaDon.ban.n > 0 && Math.abs((q.hieuLuc.ct34 ?? 0) - q.hoaDon.ban.v) > 1000
                const thieuNop = q.coChungTu && (q.phaiNop ?? 0) > q.daNop
                return (
                  <tr key={q.khoa} className="border-t border-slate-100">
                    <td className="p-2 font-medium">{tenKy(q.khoa)}</td>
                    <td className="p-2"><OTrangThai q={q} /></td>
                    <td className="p-2">{q.coTNCN ? '✅' : <span className="text-slate-400">—</span>}</td>
                    <td className="p-2 text-right tabular-nums">{q.hieuLuc ? tien(q.hieuLuc.ct34 ?? 0) : '—'}</td>
                    <td className={`p-2 text-right tabular-nums ${lechHD ? 'font-semibold text-amber-800' : ''}`}>
                      {q.hoaDon ? `${tien(q.hoaDon.ban.v)} (${q.hoaDon.ban.n})` : <span className="text-slate-400">chưa nạp</span>}
                      {lechHD && ' ⚠️'}
                    </td>
                    <td className="p-2 text-right tabular-nums">{q.phaiNop !== null ? tien(q.phaiNop) : '—'}</td>
                    <td className={`p-2 text-right tabular-nums ${thieuNop ? 'font-semibold text-red-700' : ''}`}>
                      {q.coChungTu ? tien(q.daNop) : <span className="text-slate-400">chưa nạp CT</span>}
                    </td>
                    <td className="p-2">{q.khopDauKy === null ? <span className="text-slate-400">—</span> : q.khopDauKy ? '✅' : <b className="text-red-700">⛔</b>}</td>
                    <td className="p-2"><button className="text-emerald-700 underline" onClick={() => onMoQuy(q.khoa)}>Kê khai</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-500">Số liệu lấy theo bản tờ khai đang có hiệu lực (bổ sung mới nhất, không có thì bản lần đầu). Bản bị cơ quan thuế trả về không tính.</p>
      </div>

      {tq.chungTu.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold">Chứng từ nộp tiền vào ngân sách ({tq.chungTu.length})</h3>
          <ul className="space-y-1 text-sm">
            {tq.chungTu.map((c) => (
              <li key={c.so}>
                {c.ngay} — <b className="tabular-nums">{tien(c.tong)} đ</b> — {c.dong.map((d) => `${tenTieuMuc(d.ndkt)} kỳ ${d.kyThue.replace(/^00\//, '')}`).join('; ')} <span className="text-slate-400">(số {c.so})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tq.khac.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold">Tờ khai / báo cáo khác đã lưu ({tq.khac.length})</h3>
          <ul className="space-y-1 text-sm">
            {tq.khac.map((t, i) => (
              <li key={i}>{t.tenTKhai || `Mẫu mã ${t.maTKhai}`} — kỳ {t.ky}{t.loaiTKhai === 'B' ? ` (bổ sung ${t.soLan})` : ''} <span className="text-slate-400">({t.tenFile})</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

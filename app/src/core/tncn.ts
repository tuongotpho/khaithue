// Tờ khai 05/KK-TNCN (TT80/2021) — khấu trừ thuế TNCN từ tiền lương, tiền công

import type { CanhBao } from './types.js'

/** Ô người khai tự nhập. Các ô tổng [18] [21] [26] [29] app tự cộng. */
export interface NhapTNCN {
  ct16: number // tổng số người lao động
  ct17: number // trong đó cư trú có HĐLĐ
  ct19: number // số cá nhân cư trú đã khấu trừ thuế
  ct20: number // không cư trú
  ct22: number // thu nhập chịu thuế trả cho cá nhân cư trú
  ct23: number // ... không cư trú
  ct24: number
  ct25: number
  ct25_1: number // thu nhập miễn thuế theo nghị quyết (mẫu 2.9.3)
  ct27: number // TNCT thuộc diện khấu trừ — cư trú
  ct28: number // ... không cư trú
  ct30: number // thuế đã khấu trừ — cư trú
  ct31: number // ... không cư trú
  ct32: number
}

export const NHAP_TNCN_TRONG: NhapTNCN = {
  ct16: 0, ct17: 0, ct19: 0, ct20: 0, ct22: 0, ct23: 0, ct24: 0, ct25: 0, ct25_1: 0, ct27: 0, ct28: 0, ct30: 0, ct31: 0, ct32: 0,
}

export function tinhTNCN(n: NhapTNCN): { ct: Record<string, number>; canhBao: CanhBao[] } {
  const ct = {
    ct15: 0,
    ct16: n.ct16,
    ct17: n.ct17,
    ct18: n.ct19 + n.ct20,
    ct19: n.ct19,
    ct20: n.ct20,
    ct21: n.ct22 + n.ct23,
    ct22: n.ct22,
    ct23: n.ct23,
    ct24: n.ct24,
    ct25: n.ct25,
    ct25_1: n.ct25_1,
    ct26: n.ct27 + n.ct28,
    ct27: n.ct27,
    ct28: n.ct28,
    ct29: n.ct30 + n.ct31,
    ct30: n.ct30,
    ct31: n.ct31,
    ct32: n.ct32,
  }
  const canhBao: CanhBao[] = []
  if (n.ct16 === 0) canhBao.push({ muc: 'chu_y', noiDung: 'Chưa nhập số người lao động [16]. Quý này không trả lương thì bỏ tích "Có khai quý này".' })
  if (n.ct17 > n.ct16) canhBao.push({ muc: 'loi', noiDung: '[17] lớn hơn tổng số lao động [16].' })
  if (ct.ct26 > ct.ct21) canhBao.push({ muc: 'loi', noiDung: '[26] thu nhập thuộc diện khấu trừ lớn hơn tổng thu nhập [21].' })
  if (ct.ct29 > 0 && ct.ct18 === 0) canhBao.push({ muc: 'loi', noiDung: 'Có số thuế đã khấu trừ [29] nhưng số người bị khấu trừ [18] = 0.' })
  return { ct, canhBao }
}

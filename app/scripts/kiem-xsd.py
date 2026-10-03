"""Kiểm file XML app xuất ra theo đặc tả XSD trong bộ cài HTKK trên máy.

Cách chạy (PowerShell, trong thư mục app):
    npm run kiem-xsd
"""
import glob
import os
import sys

from lxml import etree

HTKK = os.environ.get('HTKK_DIR', r'C:\Program Files (x86)\HTKK\InterfaceTemplates\Validate')
XSD = {'842': '01_GTGT_TT80_283.xsd', '864': '05_KK_TNCN_TT80_293.xsd'}
NS = {'t': 'http://kekhaithue.gdt.gov.vn/TKhaiThue'}


def main(thu_muc: str) -> int:
    if not os.path.isdir(HTKK):
        print('Không thấy HTKK tại', HTKK, '- bỏ qua')
        return 0
    loi = 0
    cache = {}
    files = sorted(glob.glob(os.path.join(thu_muc, '*.xml')))
    for f in files:
        doc = etree.parse(f)
        ma = doc.findtext('.//t:maTKhai', namespaces=NS)
        if ma not in cache:
            # Một số XSD của HTKK ghi đường dẫn kiểu Windows "..\x.xsd" -> đổi sang "/"
            duong_dan = os.path.join(HTKK, XSD[ma])
            noi_dung = open(duong_dan, 'rb').read().replace(b'schemaLocation="..\\', b'schemaLocation="../')
            goc = 'file:///' + duong_dan.replace('\\', '/')
            cache[ma] = etree.XMLSchema(etree.fromstring(noi_dung, base_url=goc))
        sch = cache[ma]
        if sch.validate(doc):
            print('ĐẠT ', os.path.basename(f))
        else:
            loi += 1
            print('LỖI ', os.path.basename(f))
            for e in sch.error_log:
                print('     dòng', e.line, e.message)
    print(f'{len(files) - loi}/{len(files)} file đạt')
    return 1 if loi or not files else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')  # PowerShell mặc định không in được tiếng Việt
    sys.exit(main(sys.argv[1]))

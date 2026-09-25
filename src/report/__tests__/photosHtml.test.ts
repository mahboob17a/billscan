import { buildPhotosHtml } from '../photosHtml';

describe('bill photos PDF html', () => {
  const html = buildPhotosHtml('Bill photos — September 2026', 'DTR-PUR-UTAS-NIZWA-2026-09', [
    { sectionLabel: 'A', sno: 1, billDate: '2026-09-17', billNo: '0022', description: 'Electrical Goods', grandTotal: 46000, photos: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'] },
    { sectionLabel: 'B (cancelled)', sno: 1, billDate: null, billNo: null, description: 'Paint <x>', grandTotal: null, photos: [] },
  ]);
  it('lists every bill on the contents page', () => {
    expect(html).toContain('<td>0022</td>');
    expect(html).toContain('Paint &lt;x&gt;');
    expect(html).toContain('46.000');
  });
  it('makes one captioned page per photo', () => {
    expect(html.match(/<section class="photo">/g)).toHaveLength(2);
    expect(html).toContain('page 2 of 2');
    expect(html).toContain('Section A · S. No 1');
  });
});

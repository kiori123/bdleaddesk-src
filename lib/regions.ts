/**
 * Vung tim kiem. MOT ban duy nhat cho ca man hinh lan luc goi SignalHire.
 *
 * Truoc day co hai ban: mot mang nhan trong SearchForm.tsx va mot bang tra
 * trong signalhire.ts, kem mot dong ghi chu bat nguoi sua phai nho sua ca hai.
 * Kieu do khong hong ngay, no hong lang le: them mot lua chon o mot ben thi ben
 * kia tra ve undefined, app bo qua bo loc dia diem va tra ve nguoi khap the
 * gioi, khong bao gi ca.
 *
 * File nay KHONG duoc import gi tu phia may chu, vi man hinh la client
 * component. Do la ly do no nam rieng thay vi nam trong signalhire.ts.
 *
 * `hint` khong phai trang tri. Chi PIC phu trach Trung Quoc doc "China only" va
 * "Greater China" ma khong biet chon cai nao, vi hai chu do khong noi ra Hong
 * Kong hay Dai Loan co nam trong khong.
 */

// Ten quoc gia phai dung y het cach SignalHire luu. Ho tra ve HTTP 422
// "Location is not recognized" neu khong hieu, chu khong lang le tra ve rong.
const VN = ['Viet Nam', 'Vietnam'];
const SEA = ['Singapore', 'Thailand', 'Malaysia', 'Indonesia', 'Philippines',
  'Cambodia', 'Myanmar', 'Laos', 'Brunei'];
const CN = ['China'];
const GCN = ['China', 'Hong Kong', 'Taiwan', 'Macau'];
const EA = ['China', 'Hong Kong', 'Taiwan', 'Macau', 'Japan', 'South Korea'];

export type Vung = {
  key: string;
  label: string;
  hint: string;
  /** null nghia la khong loc dia diem gi ca. */
  nuoc: string[] | null;
};

export const VUNG: Vung[] = [
  {
    key: 'Vietnam only',
    label: 'Vietnam',
    hint: 'People working in Vietnam.',
    nuoc: VN,
  },
  {
    key: 'Vietnam and Southeast Asia',
    label: 'Vietnam and Southeast Asia',
    hint: 'Vietnam plus Singapore, Thailand, Malaysia, Indonesia, the Philippines, '
      + 'Cambodia, Myanmar, Laos and Brunei.',
    nuoc: [...VN, ...SEA],
  },
  {
    key: 'China only',
    label: 'Mainland China only',
    hint: 'Mainland China and nothing else. Hong Kong, Taiwan and Macau are NOT included, '
      + 'so a Hong Kong based export manager of a Chinese brand will not appear.',
    nuoc: CN,
  },
  {
    key: 'Greater China',
    label: 'Mainland China, Hong Kong, Taiwan and Macau',
    hint: 'Everything in "Mainland China only", plus Hong Kong, Taiwan and Macau. '
      + 'Usually the better pick for a Chinese brand: the people who handle overseas '
      + 'partnerships are often based in Hong Kong or Taiwan rather than on the mainland.',
    nuoc: GCN,
  },
  {
    key: 'East Asia',
    label: 'East Asia',
    hint: 'Mainland China, Hong Kong, Taiwan, Macau, Japan and South Korea.',
    nuoc: EA,
  },
  {
    key: 'All Asia',
    label: 'All of Asia',
    hint: 'Vietnam, Southeast Asia, East Asia and India, all at once.',
    nuoc: [...VN, ...SEA, ...EA, 'India'],
  },
  {
    key: 'Global',
    label: 'Anywhere in the world',
    hint: 'No location filter at all. Use this when you do not know where they sit, '
      + 'or when the first try came back empty.',
    nuoc: null,
  },
  {
    key: 'Group headquarters',
    label: 'Group head office, wherever it is',
    hint: 'Ignores location entirely and looks for head office people: group, corporate, '
      + 'global, board. Use it when the decision sits at the parent company abroad, '
      + 'not in the local market.',
    nuoc: null,
  },
];

export const VUNG_MAC_DINH = 'Vietnam and Southeast Asia';

const tra = new Map(VUNG.map((v) => [v.key, v]));

export function timVung(key: string) {
  return tra.get(key) ?? null;
}

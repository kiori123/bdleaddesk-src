import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Bao cho PIC biet khi co gi do hong.
 *
 * Truoc day viec nay do n8n lo: node "On Failure" bat loi roi gui mail qua
 * Gmail. Bo n8n di ma khong lam lai thi mot lan quet chet la chet trong im
 * lang, PIC ngoi nhin man hinh quay, khong ai biet de sua.
 *
 * Khong dung mail nua vi app da co san bang notification va cai chuong tren
 * header. Bao ngay trong app thi PIC thay lien va khong phai cau hinh gi.
 *
 * HAI DIEU LUAT cua file nay:
 *
 *   1. Khong bao gio nem loi ra ngoai. Ham nay chay o duong xu ly loi, ma
 *      nem tiep o day thi loi that bi nuot, con PIC nhan duoc mot loi khac
 *      han khong lien quan. Bao hong thi ghi console roi thoi.
 *
 *   2. Dung admin client. Luc mot job that bai, phien dang nhap co the da het
 *      han hoac dang o giua mot route khong co cookie. RLS chan ghi notification
 *      cho nguoi khac, ma day dung la luc can ghi chac chan.
 */

type Muc = {
  kind?: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

export async function baoChoNguoi(profileId: string, muc: Muc) {
  if (!profileId) return;
  try {
    const { error } = await supabaseAdmin().from('notification').insert({
      profile_id: profileId,
      kind: muc.kind ?? 'system',
      title: muc.title.slice(0, 200),
      body: muc.body ? String(muc.body).slice(0, 1000) : null,
      link: muc.link ?? null,
    });
    if (error) console.error('[notify] khong ghi duoc thong bao:', error.message);
  } catch (e: any) {
    console.error('[notify] nga khi ghi thong bao:', e?.message ?? e);
  }
}

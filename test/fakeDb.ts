/**
 * Fake Supabase client cho unit test canUseCategory().
 *
 * canUseCategory() gio chi lam MOT viec: goi rpc('can_use_category', {p_user,
 * p_category}). Fake nay mo phong dung rpc do bang JS, CUNG logic voi ham SQL
 * trong can_use_category.sql:
 *
 *   is_active_admin(p_user) OR (is_active_profile(p_user) AND owns_category(p_user, p_category))
 *
 * Day la unit test NHANH cho logic phia TypeScript (canUseCategory truyen
 * tham so dung, doc ket qua dung). No KHONG thay the duoc test tich hop that
 * (test/category-access.integration.test.ts chay dung SQL that) - neu ham SQL
 * that trong DB lech khoi ban mo phong nay, test o day van xanh nhu thuong.
 */

export type FakeRow = Record<string, unknown>;

export type Fixture = {
  profiles: FakeRow[]; // { id, role, active }
  profileCategories: FakeRow[]; // { profile_id, category_id }
};

export function makeFakeDb(fixture: Fixture) {
  return {
    async rpc(fn: string, args?: Record<string, unknown>) {
      if (fn === 'can_use_category') {
        const userId = args?.p_user;
        const categoryId = args?.p_category;
        const profile = fixture.profiles.find((r) => r.id === userId);
        if (!profile?.active) return { data: false, error: null };
        if (profile.role === 'admin') return { data: true, error: null };
        const owns = fixture.profileCategories.some(
          (r) => r.profile_id === userId && r.category_id === categoryId,
        );
        return { data: owns, error: null };
      }
      throw new Error(`fakeDb: unhandled rpc ${fn}`);
    },
  };
}

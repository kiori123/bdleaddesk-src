import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

/**
 * Test tich hop THAT: chay can_use_category(), is_admin(), my_categories()
 * tren mot Postgres that (yeu cau can_use_category.sql da duoc ap dung), roi
 * kiem ca ba dong y voi nhau. Day la cho DUY NHAT thuc su bat duoc drift neu
 * ai do sua logic trong DB ma quen sua ca ba noi - test/fakeDb.ts chi mo
 * phong bang JS nen khong bat duoc loai loi nay.
 *
 * Can BA bien moi truong, co tien to INTEGRATION_ rieng de KHONG BAO GIO vo
 * tinh doc nham .env.local/production cua app that:
 *   INTEGRATION_SUPABASE_URL
 *   INTEGRATION_SUPABASE_SERVICE_ROLE_KEY
 *   INTEGRATION_SUPABASE_ANON_KEY
 *
 * Tro ba bien nay vao mot du an Supabase RIENG, dung de test (co the la
 * Supabase local qua `supabase start`, hoac mot project throwaway), da chay
 * schema.sql + can_use_category.sql. Test tu don sach du lieu no tao ra,
 * nhung van la thao tac ghi that len project do - dung tro vao production.
 *
 * Neu thieu bien, test bao SKIP ro rang thay vi im lang bien mat khoi ket qua.
 */

const URL = process.env.INTEGRATION_SUPABASE_URL;
const SERVICE_KEY = process.env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.INTEGRATION_SUPABASE_ANON_KEY;

const SKIP_REASON =
  'INTEGRATION_SUPABASE_URL / INTEGRATION_SUPABASE_SERVICE_ROLE_KEY / INTEGRATION_SUPABASE_ANON_KEY '
  + 'is not set - this test did NOT run in this environment. Point them at a disposable Supabase '
  + 'project (schema.sql + can_use_category.sql already applied) to actually exercise it.';

const canRun = Boolean(URL && SERVICE_KEY && ANON_KEY);

test(
  'can_use_category(), is_admin() and my_categories() agree, against a real Postgres',
  { skip: canRun ? false : SKIP_REASON },
  async () => {
    const admin = createClient(URL!, SERVICE_KEY!);
    const stamp = Date.now();
    const madeUsers: string[] = [];
    let categoryId = '';

    async function makeUser(role: 'admin' | 'pic', active: boolean, email: string) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: `test-pw-${stamp}!A1`,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error(`could not create ${email}`);
      madeUsers.push(data.user.id);

      const { error: profErr } = await admin
        .from('profile')
        .insert({ id: data.user.id, role, active });
      if (profErr) throw profErr;

      return data.user.id;
    }

    async function sessionFor(email: string) {
      const anon = createClient(URL!, ANON_KEY!);
      const { data, error } = await anon.auth.signInWithPassword({
        email,
        password: `test-pw-${stamp}!A1`,
      });
      if (error || !data.session) throw error ?? new Error(`could not sign in as ${email}`);
      return createClient(URL!, ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      });
    }

    try {
      // --- to hop fixture: 1 category, 5 nguoi dung -------------------------
      const { data: cat, error: catErr } = await admin
        .from('category')
        .insert({ name: `Integration Test ${stamp}`, slug: `integration-test-${stamp}`, active: true })
        .select('id')
        .single();
      if (catErr) throw catErr;
      categoryId = cat.id as string;

      const activeAdminEmail = `it-active-admin-${stamp}@example.test`;
      const activePicEmail = `it-active-pic-${stamp}@example.test`;
      const inactivePicEmail = `it-inactive-pic-${stamp}@example.test`;
      const inactiveAdminEmail = `it-inactive-admin-${stamp}@example.test`;
      const noCatPicEmail = `it-no-cat-pic-${stamp}@example.test`;

      const activeAdminId = await makeUser('admin', true, activeAdminEmail);
      const activePicId = await makeUser('pic', true, activePicEmail);
      const inactivePicId = await makeUser('pic', false, inactivePicEmail);
      const inactiveAdminId = await makeUser('admin', false, inactiveAdminEmail);
      const noCatPicId = await makeUser('pic', true, noCatPicEmail);

      const { error: pcErr } = await admin.from('profile_category').insert([
        { profile_id: activePicId, category_id: categoryId },
        { profile_id: inactivePicId, category_id: categoryId },
      ]);
      if (pcErr) throw pcErr;

      // --- can_use_category(): goi qua service role, p_user bat ky ---------
      const cases: { label: string; userId: string; expected: boolean }[] = [
        { label: 'active admin', userId: activeAdminId, expected: true },
        { label: 'active PIC who owns the category', userId: activePicId, expected: true },
        { label: 'deactivated PIC with a real profile_category row', userId: inactivePicId, expected: false },
        { label: 'deactivated admin', userId: inactiveAdminId, expected: false },
        { label: 'active PIC with no category', userId: noCatPicId, expected: false },
      ];

      for (const c of cases) {
        const { data, error } = await admin.rpc('can_use_category', {
          p_user: c.userId,
          p_category: categoryId,
        });
        if (error) throw error;
        assert.equal(data, c.expected, `can_use_category: ${c.label}`);
      }

      // --- is_admin() / my_categories(): goi duoi PHIEN THAT cua tung nguoi -
      // Hai ham nay doc auth.uid(), nen phai goi qua mot client da dang nhap
      // that su bang JWT cua tung nguoi, khong the goi qua service role.
      const activeAdminDb = await sessionFor(activeAdminEmail);
      const activePicDb = await sessionFor(activePicEmail);
      const noCatPicDb = await sessionFor(noCatPicEmail);

      const { data: adminIsAdmin } = await activeAdminDb.rpc('is_admin');
      assert.equal(adminIsAdmin, true, 'is_admin() phai dong y voi can_use_category cho active admin');

      const { data: picIsAdmin } = await activePicDb.rpc('is_admin');
      assert.equal(picIsAdmin, false, 'is_admin() phai dong y voi can_use_category cho active PIC');

      const { data: picCats } = await activePicDb.rpc('my_categories');
      assert.ok(
        Array.isArray(picCats) && picCats.includes(categoryId),
        'my_categories() phai chua category ma active PIC so huu, dong y voi can_use_category',
      );

      const { data: noCatCats } = await noCatPicDb.rpc('my_categories');
      assert.deepEqual(noCatCats ?? [], [], 'my_categories() phai rong cho PIC khong thuoc category nao');
    } finally {
      // --- don dep: xoa het nhung gi vua tao, du test pass hay fail ---------
      if (categoryId) {
        await admin.from('profile_category').delete().eq('category_id', categoryId);
        await admin.from('category').delete().eq('id', categoryId);
      }
      for (const id of madeUsers) {
        await admin.from('profile').delete().eq('id', id).then(() => {});
        await admin.auth.admin.deleteUser(id).catch(() => {});
      }
    }
  },
);

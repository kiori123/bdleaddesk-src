-- Retire the "Cross Boder" category (id 9a53cb4f-55c9-49ce-a6d8-b51434a59c51)
-- and clean up its one test brand.
--
-- Read-only check before writing this file found, under this category:
--   - 1 brand (SANDJEST), 1 contact (Minh Tan Vo, no email/phone - the
--     reveal never got contact info back, same shape as the Parroti case)
--   - 1 credit_budget row: 150 granted for 2026-09
--   - 2 credit_ledger rows, amount 1 each, BOTH stuck at status='reserved'
--     since 2026-09-11 - their job_id points at reveal jobs 8c1727ff... and
--     c5fecc46... which are themselves stuck at status='running'. This is
--     the exact bug already described in fix_stuck_reveal_jobs.sql (a crash
--     before the reveal route's try/catch fix, which never ran
--     releaseCredit()/marked the job failed). Left as 'committed' here
--     rather than released: these 2 credits were genuinely spent testing
--     the app, so they stay counted as used - just labelled why.
--   - 3 search_usage rows (10 brands / 4 profiles). NOT touched by this
--     file: they already happened against SignalHire's real daily cap, and
--     CLAUDE.md is explicit that a test run's usage must stay on the books
--     even after the test data is removed, or the app's daily counter drifts
--     from SignalHire's own.
--
-- Why this DEACTIVATES the category instead of deleting the row: schema.sql
-- has credit_ledger.category_id as `references category(id) on delete
-- restrict`, on purpose - so a category can never be dropped while it still
-- has real credit history hanging off it (deleting the row would force
-- deleting the ledger rows too, which erases that credits were ever spent).
-- category.active exists for exactly this case; every category picker in
-- the app already filters on it (e.g. app/(app)/page.tsx). Cross Boder stops
-- showing up anywhere new is trackable/selectable, and its ledger/budget
-- history stays intact and correct.
--
-- One-off. Run once in the Supabase SQL Editor.

begin;

-- 1. Reconcile the two stuck-reserved credits as SPENT, not refunded - these
--    two credits were genuinely used for testing, so they stay counted as
--    used rather than released back, just clearly labelled why.
update credit_ledger
set status = 'committed',
    settled_at = now(),
    note = 'testing: 2 credits'
where category_id = '9a53cb4f-55c9-49ce-a6d8-b51434a59c51'
  and status = 'reserved';

-- 2. Mark the two reveal jobs that never finished as failed, so Job status
--    stops reading as "still running".
update job
set status = 'failed',
    error = 'credit for testing - Cross Boder scratch category, reconciled 2026-09-15'
where id in ('8c1727ff-2728-430d-9d05-2cb1b36a63e2', 'c5fecc46-c60c-4304-aac9-d5b3607412aa')
  and status = 'running';

-- 3. Remove the one test brand (SANDJEST). Cascades to its single contact
--    (Minh Tan Vo) automatically via contact.brand_id on delete cascade.
delete from brand where id = '391c1545-f3ca-4364-8310-43dde02e5082';

-- 4. Retire the category itself.
update category set active = false
where id = '9a53cb4f-55c9-49ce-a6d8-b51434a59c51';

commit;

-- Check afterwards: category_credit_status for Cross Boder should show
-- used = 2 (both rows now committed, clearly noted as testing), and the
-- category should no longer appear in any "active" category list in the app.
-- select * from category_credit_status where category_id = '9a53cb4f-55c9-49ce-a6d8-b51434a59c51';

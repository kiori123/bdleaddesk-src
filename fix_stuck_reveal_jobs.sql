-- Don dep cac job kind='reveal' bi treo o status='running' vinh vien, cung
-- credit_ledger tuong ung con ket o 'reserved' vinh vien.
--
-- Nguyen nhan: /api/reveal (truoc ban vao app/api/reveal/route.ts them
-- try/catch bao ve, xem commit lien quan) khong bat duoc loi bat ngo giua
-- chung (vi du SignalHire treo qua lau, khong co timeout o goiSignalHire()).
-- Function bi Vercel giet ngang truoc khi kip chay toi releaseCredit()/
-- job.update({status:'failed'}), nen job va credit_ledger ket lai mai mai.
--
-- Xac minh 2026-09-14: 9 dong job kind='reveal' status='running', amount=1,
-- error=null, trai dai tu 2026-09-10 den 2026-09-14, moi dong co dung MOT
-- dong credit_ledger status='reserved' voi cung job_id.
--
-- Chay MOT LAN, sau khi da deploy ban co try/catch moi (de khong "don" nham
-- mot job dang chay that su). Nguong 1 gio du an toan: function toi da chay
-- maxDuration=60 giay.

-- 1. Tra credit truoc (subquery duoi doc job.status='running', phai chay
--    truoc khi buoc 2 doi status sang 'failed').
update credit_ledger
set status = 'released',
    settled_at = now(),
    note = 'stuck reveal job (crashed before reveal try/catch fix, 2026-09) - reconciled by ops script'
where status = 'reserved'
  and job_id in (
    select id from job
    where kind = 'reveal' and status = 'running' and created_at < now() - interval '1 hour'
  );

-- 2. Danh dau job that bai, de PIC/admin thay ro trong Job status thay vi
--    tuong dang con chay.
update job
set status = 'failed',
    error = 'stuck (crashed before reveal try/catch fix, 2026-09) - reconciled by ops script'
where kind = 'reveal' and status = 'running' and created_at < now() - interval '1 hour';

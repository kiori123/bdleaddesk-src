-- Reclassify every "Verified seed list" contact under Mom & Baby as "Added by hand".
--
-- Read-only check before writing this file found 43 contacts across 38 brands
-- in Mom & Baby (category id 648b2931-5cc9-4d7f-a331-90c96e3e8713) currently
-- at source = 'seed_verified'.
--
-- What this changes: only the Origin badge and the "found by app vs added by
-- hand" split in Admin > Usage (isAppGenerated, lib/contactOrigin.ts). It does
-- NOT touch credit-usage numbers - seed_verified and manual are both already
-- counted as free/non-billed there (isByCredit only counts signalhire and
-- pasted_linkedin, see UsagePanel.tsx), so nothing about credits spent
-- changes.
--
-- One-off. Run once in the Supabase SQL Editor.

update contact set source = 'manual'
where source = 'seed_verified'
  and brand_id in (
    select id from brand
    where category_id = (select id from category where name = 'Mom & Baby')
  )
returning id, brand_id, full_name, source;

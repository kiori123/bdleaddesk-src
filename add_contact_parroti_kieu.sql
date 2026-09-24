-- Fill in the email for the existing "Thanh Kieu" contact on brand "Parroti".
--
-- This is NOT a new person. The brand search already found and saved this
-- candidate (job 520830b7-d6a6-417b-b745-5ff15a20bb5e, contact id
-- 16c6e710-870b-4e7c-8cc9-bcb2a53b5ee7): SignalHire's reveal API ran for her
-- and came back with no email/phone (nothing was charged - the app only bills
-- for a person it actually gets contact info for). That's why the app showed
-- "No contact": the person is on file, just with an empty email/phone.
--
-- The SignalHire browser extension, used by hand directly on her profile,
-- found kieuthanhthanh.dn@gmail.com where the API call had come up empty.
-- Update the SAME row instead of inserting a second one, or she ends up
-- duplicated on the org chart (one entry with no contact info, one with the
-- email). source -> 'manual' because this email did not come from the app's
-- reveal pipeline - see lib/contactOrigin.ts: it's the one field the "Origin"
-- badge and the credit-usage accounting in UsagePanel.tsx read to tell
-- "found by the app" apart from "added by hand".
--
-- One-off. Run once in the Supabase SQL Editor.

update contact set
  email = 'kieuthanhthanh.dn@gmail.com',
  source = 'manual',
  revealed_by = (select id from profile where email = 'khoa.nguyend@onpoint.vn')
where id = '16c6e710-870b-4e7c-8cc9-bcb2a53b5ee7'
  and brand_id = (select id from brand where name_key = 'parroti')
returning id, brand_id, full_name, email, source;

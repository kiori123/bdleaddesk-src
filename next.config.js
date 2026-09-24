/** @type {import('next').NextConfig} */

/*
 * Ma so cua lan build nay.
 *
 * Sinh ra luc build, nen moi lan deploy la mot so khac. Next nhet gia tri trong
 * `env` THANG VAO CODE luc build, ca phia may chu lan phia trinh duyet.
 *
 * Do chinh la co che de biet co ban moi hay chua:
 *   - Cua so app dang mo cua PIC chay ban CU  -> mang ma so cu trong code
 *   - /api/version do ban vua deploy phuc vu  -> tra ve ma so moi
 * Hai so lech nhau tuc la co ban moi. Xem app/(app)/UpdateBanner.tsx.
 *
 * Dung gio build chu khong dung ma commit: du an nay deploy thang bang
 * `vercel --prod` chu khong qua git, nen ma commit khong doi moi lan deploy.
 */
const BUILD_ID = String(Date.now());

module.exports = {
  reactStrictMode: true,
  env: { APP_BUILD_ID: BUILD_ID },
};

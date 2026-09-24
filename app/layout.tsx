import type { Metadata } from 'next';
import './globals.css';
import RegisterSW from './RegisterSW';

export const metadata: Metadata = {
  title: 'BD Lead Hub',
  description: 'Find the decision makers at any brand, in any category, then reach them.',
  robots: { index: false, follow: false },
  // Next tu them <link rel="manifest"> tu app/manifest.ts, khong can khai o day.
  icons: {
    icon: [{ url: '/favicon-64.png', sizes: '64x64', type: 'image/png' }],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'BD Lead Hub', statusBarStyle: 'default' },
};

// Mau thanh dia chi tren trinh duyet dien thoai, khop nen cua app.
export const viewport = { themeColor: '#EDF4F3' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* Bat su kien cai app TRUOC khi React kip chay.
            Chrome ban su kien beforeinstallprompt rat som, thuong xong truoc
            luc React gan tai nghe. Su kien nay chi ban DUNG MOT LAN: lo mat la
            mat luon, nut Install app khong bao gio hien. Nen cat no vao window
            ngay tu day, InstallApp.tsx moc ra sau. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__caiApp=e;window.dispatchEvent(new Event('bdlh:caiDuoc'))});",
          }}
        />
      </head>
      <body className="font-sans text-[13.5px] text-ink">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}

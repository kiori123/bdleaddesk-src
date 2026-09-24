import type { MetadataRoute } from 'next';

/**
 * Cho phep PIC cai app len Desktop nhu mot phan mem rieng.
 *
 * Vi sao dung file nay thay vi public/manifest.json: Next tu phuc vu no o
 * /manifest.webmanifest va tu them the <link rel="manifest"> vao moi trang, nen
 * khong the quen gan the do o mot layout nao do.
 *
 * display 'standalone' la thu bien no thanh cua so rieng, khong thanh dia chi,
 * khong tab. Doi thanh 'browser' la mat luon kha nang cai.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BD Lead Hub',
    short_name: 'BD Lead Hub',
    description: 'Tim va xac minh decision-maker tai cac brand, theo doi tien do deal.',
    // Mo thang vao Brand board. Chua dang nhap thi middleware tu day sang /login
    // roi quay lai day, nen khong can tro start_url vao trang dang nhap.
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#EDF4F3',
    theme_color: '#0C3D47',
    lang: 'en',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Ban maskable co vien rong hon, de he dieu hanh cat theo hinh dang rieng
      // cua no ma khong xen mat logo.
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'New scan', short_name: 'Scan', url: '/scan' },
      { name: 'Credits', short_name: 'Credits', url: '/credits' },
    ],
  };
}

'use client';

import { useEffect, useState } from 'react';

/**
 * Nut cai app len may.
 *
 * VI SAO CAN NUT NAY. Chrome tu hien mot bieu tuong cai o thanh dia chi, nho va
 * de bo qua. Safari tren iPhone thi KHONG co gi ca: muon cai phai bam Share roi
 * keo xuong tim "Add to Home Screen", khong ai tu doan ra.
 *
 * BAN TRUOC SAI O DAU. No chi hien nut khi bat duoc su kien beforeinstallprompt,
 * hoac khi doan ra la Safari iOS. Hai cai deu hut:
 *
 *   1. Su kien do Chrome ban RAT SOM, thuong truoc khi React kip gan tai nghe,
 *      va no chi ban dung mot lan. Lo mat la nut khong bao gio hien. Nay bat tu
 *      trong <head> o app/layout.tsx roi cat vao window.__caiApp.
 *   2. Doan trinh duyet bang userAgent thi luon co may roi ra ngoai, ma roi ra
 *      thi nut bien mat khong dau vet. Dung cai vua gap.
 *
 * NAY DOI CACH: chua chay trong cua so app thi LUON hien nut. Bam duoc hop thoai
 * cai that thi goi hop thoai; khong thi mo bang chi tung buoc. Chi dan bang chu
 * co the thua voi vai may, nhung thua van hon la mat nut.
 */

type Loi = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallApp() {
  const [suKien, setSuKien] = useState<Loi | null>(null);
  const [iOS, setIOS] = useState(false);
  const [trongApp, setTrongApp] = useState(true); // mac dinh AN cho den khi biet chac
  const [chiDan, setChiDan] = useState(false);

  useEffect(() => {
    const dangChayTrongApp = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    setTrongApp(dangChayTrongApp);
    if (dangChayTrongApp) return;

    const ua = navigator.userAgent;
    // iPad moi bao minh la Macintosh, phai xet them man hinh cam ung.
    setIOS(/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));

    // Su kien co the da ve tu truoc luc React chay, nen doc cho cat truoc.
    const co = (window as any).__caiApp as Loi | undefined;
    if (co) setSuKien(co);

    const den = () => setSuKien((window as any).__caiApp ?? null);
    window.addEventListener('bdlh:caiDuoc', den);

    const xong = () => {
      setTrongApp(true);
      setSuKien(null);
      (window as any).__caiApp = null;
    };
    window.addEventListener('appinstalled', xong);

    return () => {
      window.removeEventListener('bdlh:caiDuoc', den);
      window.removeEventListener('appinstalled', xong);
    };
  }, []);

  if (trongApp) return null;

  return (
    <>
      <button
        type="button"
        className="mini"
        onClick={async () => {
          if (suKien) {
            try {
              await suKien.prompt();
              const { outcome } = await suKien.userChoice;
              if (outcome === 'accepted') setTrongApp(true);
              setSuKien(null);
              (window as any).__caiApp = null;
              return;
            } catch {
              // Su kien het han (da dung mot lan roi). Roi xuong chi dan.
              setSuKien(null);
              (window as any).__caiApp = null;
            }
          }
          setChiDan(true);
        }}
      >
        Install app
      </button>

      {chiDan && (
        <div className="modal-bg on" onClick={() => setChiDan(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <div>
                <div className="modal-t">Add to home screen</div>
                <div className="modal-s">{iOS ? 'Three taps, once' : 'Two taps, once'}</div>
              </div>
              <button className="modal-x" onClick={() => setChiDan(false)}>×</button>
            </div>
            <div className="modal-b">
              <p className="note" style={{ marginBottom: 12 }}>
                Do it once and the app gets its own icon, opens without the address bar, and
                stays signed in.
              </p>

              {iOS ? (
                <>
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                    <li>Tap the <b>Share</b> button at the bottom of Safari</li>
                    <li>Scroll down and tap <b>Add to Home Screen</b></li>
                    <li>Tap <b>Add</b> in the top right</li>
                  </ol>
                  <p className="note" style={{ marginTop: 12 }}>
                    It has to be Safari. Chrome on iPhone cannot add apps to the home screen.
                  </p>
                </>
              ) : (
                <>
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                    <li>Open the browser menu (<b>⋮</b> on Android, <b>⋯</b> on desktop)</li>
                    <li>Tap <b>Install app</b>, or <b>Add to Home screen</b></li>
                  </ol>
                  <p className="note" style={{ marginTop: 12 }}>
                    If neither shows up, the app is most likely already installed. Look for the
                    BD Lead Hub icon on your home screen.
                  </p>
                </>
              )}
            </div>
            <div className="modal-f">
              <button className="btn2" onClick={() => setChiDan(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

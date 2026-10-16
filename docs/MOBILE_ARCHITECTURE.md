# Mobil Mimari Karari

Tarih: 10 Ekim 2026
Durum: 15 Ekim 2026 karariyla asagidaki ilk native UI yaklasimi yerine ortak web arayuzu kullaniliyor.

## 15 Ekim 2026: Birebir arayuz ve tek hesap

Kullanici web ile tipatip ayni ekranlari ve tum ozellikleri istiyor. Ayrica yazilan
native ekranlar bu hedefi karsilamadi. Expo uygulamasi korunacak, ana deneyim
React Native WebView icinde mevcut web uygulamasindan sunulacak. WebView ayni
origin'deki HTML, CSS, ikonlar, API ve HttpOnly oturumu kullanir; ikinci bir
arayuz/tema kopyasi veya mobil hesap veritabani tutulmaz. Sunucu adresi derleme
ayari olur, normal giriste kullanicidan adres istenmez. HTTPS release icin zorunludur.
Geri hareketi, dis baglantilar, dosya paylasimi ve uygulamaya donuste yenileme
native kabukta ele alinir. WebGL yuz eslestirme, dosya secici ve izinler iki
platformda ayrica dogrulanmadan ozellik esitligi tamamlanmis sayilmaz.

Tek hesap mevcut DB'de kalir. Coklu grup uyeligi bu hesabi grup icindeki uye
kaydina baglar. Her grubun mevcut semayi kullanan ayri D1 binding'i vardir;
bu sinir kitap, oy, medya, misafir, cop kutusu ve yetkileri birlikte ayirir.
Mevcut grubun DB'si ve kayit numaralari korunur. Ortak hesap sorgulari her zaman
kimlik DB'sine, grup istekleri yalniz sunucunun dogruladigi uyeligin DB'sine gider.
Istemci binding veya rol secemez. Grup tercihleri hesap+grup icin sunucuda saklanir.
Bu modelde yeni grup acmak kontrollu DB/binding provizyonu gerektirir; herkese acik
grup olusturma veya kendi kendine uye ekleme bu istegin kapsami degildir.

READING_GROUPS_ENABLED kapaliyken mevcut tek grup davranisi korunur. Gelistirme
ortami ayri yerel DB'ler ve sentetik hesaplar kullanir. Uretim migration'i, mevcut
hesaplari birlestirme veya deploy bu calismada otomatik yapilmaz. Kaynak kod
push'u kullanicinin onayladigi ayri islemdir; uretim etkinlestirmesi degildir.
Acik oldugunda eksik migration/binding guvenli hata verir, eski gruba donmez.
Bir uyelik dogrudan uygulamaya; birden fazlasi giristen sonra grup secimine gider.
Profilde grup degisimi yeni sayfa yuklemesiyle eski ekran durumunu temizler.
Eski sekmeden giden yazmalar grup kimligi denetimiyle reddedilir.

Kaynaklar: https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md
ve https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/

## Native adaptorler

`mobile/src/shell-policy.ts` origin, deep link ve kopru mesajlarini dogrular.
Paylasim ve ZIP/ICS aktarimi `native-share.ts` ile sistem paylasimina gider;
64 KiB parcalar, disk alani kontrolu, aktarim iptali ve gecici dosya temizligi
vardir. Alicinin URI'yi okuyabilmesi icin tamamlanan dosya bes dakika tutulur.
Web surumundeki normal indirme davranisi degismez.

`native-notifications.ts`, web bildirim merkezinin mevcut yeni/yaklasan bulusma
olaylarini Expo yerel cihaz bildirimine tasir. Izin yalniz kullanici komutuyla
istenir; reddetme ve cihaz ayarlarindan kapatma ayri ele alinir. Bildirim linki
grup ve bulusma kimligini tasir, native acilista tekrar dogrulanir. Bu, sunucudan
kapali uygulamaya yeni olay push'u degildir; APNs/FCM kaydi eklenmedi.

SDK56 bildirim sozlesmesi: https://docs.expo.dev/versions/v56.0.0/sdk/notifications/

## Onceki karar (tarihsel kayit)

## Okunan kaynaklar

- `AGENTS.md`
- `docs/MOBILE_HANDOFF.md`
- `docs/MOBILE_ACCEPTANCE.md`
- `README.md`
- Mevcut kaynak envanteri: `app/page.tsx`, `components/profile-view.tsx`, `components/appearance-provider.tsx`, `lib/types.ts`, `lib/meeting-time.ts`, `app/api/*`, `drizzle/0000`-`0007`
- Expo belgeleri: https://docs.expo.dev/get-started/create-a-project/
- Expo Router belgeleri: https://docs.expo.dev/develop/app-navigation/
- React Native networking belgeleri: https://reactnative.dev/docs/network

## Karar

Mobil uygulama `mobile/` klasorunde Expo + React Native + Expo Router olarak baslatilacak. Mevcut web uygulamasi, Cloudflare D1 backend'i, hesaplar, migration sirasi ve API sozlesmesi korunacak. Mobil istemci sunucu sirri veya D1 baglantisi tasimayacak; yalniz HTTPS API origin'i uzerinden mevcut `/api/auth/*`, `/api/state`, `/api/action`, `/api/upload`, `/api/media/*` ve `/api/calendar/*` yollarini kullanacak.

Ilk paketleme Expo 56 hattina pinlidir. 10 Ekim 2026'da Expo 57 guncel hat olarak gorundu, ancak repo `minimumReleaseAge` politikasi 6 Ekim 2026'da yayinlanan Expo 57 paketlerini henuz kabul etmiyor. Bu yuzden baslangic iskeleti policy uyumlu olgun Expo 56 paketleriyle kuruldu; Expo 57'ye gecis ayri bir bakim isi olarak ele alinacak.

Ilk hedef bir native kabuk degil, ozellik esligi icin gelisebilir native istemcidir. Paylasilabilir saf TypeScript tipleri ve is kurallari web kaynaklarindan type-only olarak izlenecek; DOM, CSS, Worker env, D1 ve service worker bagimli kod mobil pakete kopyalanmayacak.

## Degerlendirilen secenekler

1. Expo + React Native
   - iOS ve Android icin tek kod tabani, native izinler, paylasim, dosya, bildirim, deep link ve kamera/fotograf adaptorlerine uygun.
   - Webdeki dort scheme icin semantik token katmani kurulabilir.
   - Cookie tabanli auth, korumali medya ve yuz eslestirme icin ayrica kanit gerekir.

2. WebView veya PWA kabugu
   - Web ozelliklerini hizli tasir, fakat devir belgesindeki riskleri buyutur: same-origin cookie, CSP/CORS, korumali medya, native push, deep link, dosya disari aktarimi ve gercek native kabul kaniti belirsiz kalir.
   - Ana yaklasim olarak secilmedi. Yuz eslestirme gibi cok riskli alanlarda gecici teknik kanit icin ayrica degerlendirilebilir.

3. Ayri Swift/Kotlin uygulamalari
   - Platforma ozgu kaliteyi artirir, fakat iki UI ve iki tema sistemiyle dort tasarim sablonunu es zamanli korumak maliyetli olur.
   - Mevcut React/TypeScript bilgi birikimini ve tip sozlesmelerini paylastirmadigi icin ilk secenek degil.

## Paket sinirlari

- `mobile/`: Expo uygulamasi, native ekranlar, native tema tokenlari, API istemcisi ve platform adaptorleri.
- `lib/types.ts`: `AppData` ve domain tipleri icin kaynak sozlesme. Mobil taraf yalniz type-only import eder.
- `app/api/*`: mevcut backend sozlesmesi. Mobil istemci icin yeni endpoint gerekiyorsa web regresyonlari ve sunucu yetkileri birlikte test edilecek.
- `docs/MOBILE_ACCEPTANCE.md`: iOS ve Android sonuc kaydi; simulator sonucu gercek cihaz diye yazilmayacak.

## Auth ve medya stratejisi

Mevcut backend HttpOnly `okuma_session` cookie'si verir. Mobil istemci ilk asamada `fetch(..., { credentials: "include" })` ile login ve state kaniti alacak. React Native networking belgelerinde iOS redirect ve `Set-Cookie` davranisi icin sinirlar oldugu icin su senaryolar dogrulanmadan tamamlandi sayilmayacak:

- Login sonrasi `/api/state` ayni oturumu gormeli.
- Korumali `/api/media/<key>` istekleri oturumla yuklenmeli, oturumsuz reddedilmeli.
- Parola degisince eski oturum state/media/action kullanamamali.
- iOS'ta cookie saklama sorun cikarsa once native cookie manager veya backend uyum endpoint'i tasarlanacak; token URL'e, loga veya binary'ye yazilmayacak.

## Tema stratejisi

Webdeki uc katman korunur:

- palette tokenlari: scheme ve dark/light renkleri
- semantik roller: `color*`, `control*`, `tab*`
- component stilleri: native ekranlar yalniz semantik rolleri tuketir

Scheme kimlikleri `editorial`, `catalogue`, `notebook`, `minimal`; renk modu `light`, `dark`, `system`. Mobil tercih anahtarlari webdeki isimlerle ayni tutulur: `kitapTahlilScheme` ve `kitapTahlilColorMode`.

Notebook icin Design Lab grameri native ekranlara ayrica tasinacak: ust navigasyon, mobil alt navigasyon, ruled paper, margin line, sari etiketler, konturlu komutlar, ledger satirlari ve bolunmus profil istatistikleri. Ilk iskelet yalniz token ve navigasyon temelini kurar; gorsel eslik dogrulamasi bekliyor.

## Ilk asama kapsami

1. Expo paketi ve calistirma scriptleri.
2. API origin ayari, login/logout, state yenileme ve paylasim linki icin meeting id tasima temeli.
3. Dort scheme + light/dark/system tokenlari ve tercih kaliciligi.
4. Ana/Bulusmalar/Plan/Profil sekmelerinin veri okuyan ilk native kabugu.
5. Kabul listesindeki ilgili satirlari `Gelistiriliyor` olarak isaretleme.

## Acik riskler

- Native push altyapisi yok; APNs/FCM ve sunucu olay yayini ayrica tasarlanacak.
- Yuz eslestirme `@vladmandic/human`, WebGL ve DOM bagimliliklari nedeniyle native kanit bekliyor.
- Uretim migration durumu bilinmiyor; D1'e yeni SQL uygulanmadan once hedef ortam ayrica dogrulanacak.
- iOS derleme/test bu Linux ortaminda dogrudan yapilamaz; EAS veya macOS/Xcode erisimi gerekecek.
- Imzalama, bundle id, desteklenen OS surumleri, store hesaplari ve cihaz listesi henuz kesin degil.

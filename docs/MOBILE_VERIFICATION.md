# Gelistirme Dogrulama Ozeti

16 Ekim 2026. Uretim deploy'u, uretim SQL'i ve magaza yayini yapilmadi.
Native sinirlarin tam listesi [kabul belgesinde](MOBILE_ACCEPTANCE.md).

## Tamamlanan Kontroller

| Kontrol | Sonuc |
| --- | --- |
| Backend baglam, yetki, legacy ve redirect birim testleri | 88 kontrol |
| Gercek yerel D1 API akislari | 20 senaryo |
| Ek gruba ozel hesap, iptal, gecmis uye ve rollback | Ayri yerel D1 entegrasyon testi |
| Dort sablon x iki mod, 390px/1440px web | 193 goruntu/geometri kontrolu |
| Ozellik kapali eski web | Giris/state/yazma, gizli grup UI'si, sekiz gorunum ve rollback reddi |
| Android API36 kurulu WebView | 101 goruntu/geometri kontrolu ve native akislar |
| Android bildirimleri | Ret, tekrar isteme, kalici ret, onay, yerel bildirim ve soguk acilis |
| Android dosya aktarimi | Sistem paylasimi, ICS ve 21 MiB SHA256 butunlugu |
| Android medya ve model | Sentetik foto yukleme/galeri/silme, ZIP icerigi, yerel modelleri soguk yukleme ve bos yuz reddi |
| Native kopru politikasi | 11 test; origin, URL, komut, dosya, bildirim ve yeniden hazir sinyali |
| Web/mobil TypeScript | Basarili |
| UI sozlesmesi | 17 token, dort sablon x iki mod, 18 bilesen, yedi kontrast kontrolu |
| ESLint | Sifir hata; var olan 16 uyari |
| Uretim web build | Basarili; buyuk chunk ve vinext siniflandirma uyarilari var |
| Android debug APK | Basarili, x86_64; kurulum ve acilis basarili |
| iOS | Prebuild yapilandirma ve JS/Hermes export basarili; Xcode/native test degil |

Web ve Android matrisleri Ana sayfa, Arsiv, Plan, Bulusma ve sekiz Profil
sekmesini kapsar. Web testi, gruba ait tercihin ilk HTML'de bulunmasini ve
React mount olduktan sonra gelen native bildirim koprusunu da denetler.
Android akisinda OS temasini canli degistirme, modal/klavye geri, bagimsiz web
oturumunda favori okuma, kaydedilmemis yorumun resume'da korunmasi, grup ici
rol degisimi, kalici oturum ve grup kimlikli deep link vardir.

Gercek cihaz bildirimine dokunma testi, uygulama sureci durdurulduktan sonra
dogru grup ve bulusmanin acilmasini denetler. Bu, sunucudan kapali uygulamaya
yeni olay push'u gonderildigi anlamina gelmez.

## Grup Adi Takibi

17 Ekim 2026: uygulama basliklari secili grubun adina baglandi. Web kontrolu
ilk HTML, tum marka etiketleri, sekme/Apple metaverisi, manifest, takvim adi,
anonim isim gizliligi ve profil uzerinden iki yonlu grup gecisini kapsar.
32 uzun/kesintisiz/HTML benzeri ad gorunumu dort sema, iki mod ve iki genislikte
kontrol edildi; toplam 35 kayit ve sifir tarayici hatasi vardir. Mevcut 193 web
gorunumu ve bayrak kapali sekiz legacy gorunum de yeniden gecti.

API36 kurulu Android uygulamasinda profilden `default` ve `second` gruplarina
gecilerek gorunen ad, sekme basligi, alt bilgi ve manifest adi ayrica denetlendi.
Bu odakli kontroldur; onceki 101 native senaryo yeniden kosuldu anlamina gelmez.
iOS native grup adi kontrolu macOS/Xcode erisimi olmadigindan halen engellidir.
PWA kisayolu/native baslatici adi sinirlari [grup rehberindedir](READING_GROUPS.md).

- [Grup adi web raporu](mobile-evidence/group-branding-report.json)
- [Android birinci grup](mobile-evidence/group-branding-android-default.png)
- [Android ikinci grup](mobile-evidence/group-branding-android-second.png)

## Kanitlar

- [Web matrisi](mobile-evidence/web-layout-report.json)
- [Android matrisi](mobile-evidence/android-layout-report.json)
- [Android medya](mobile-evidence/android-media-report.json)
- [Android bildirim](mobile-evidence/android-notifications-report.json)
- [Grup secimi](mobile-evidence/group-selection.png)
- [Defter ana sayfa](mobile-evidence/notebook-light-home.png)
- [Koyu bulusma](mobile-evidence/notebook-dark-meeting.png)
- [Profil gorunumu](mobile-evidence/notebook-light-profile-G_r_n_m.png)
- [Ikinci grup/katilimci](mobile-evidence/second-group-member.png)
- [Sistem album paylasimi](mobile-evidence/album-share.png)
- [Cihaz bildirimi](mobile-evidence/notification-drawer.png)

Tum hesaplar ve fotograflar sentetiktir. Yerel parolalar ve oturum anahtarlari
Git disindadir. Build varliklari yerel sirlarin bulunmadigi yonunde tarandi.
Android manifestinde kamera ve bildirim izinleri korundu; kullanilmayan
mikrofon/biyometri izinleri kaldirildi ve Android uygulama yedegi kapatildi.

## Yayin Kapilari

17 Ekim 2026: [Google Play test/yayin duzeni](GOOGLE_PLAY_RELEASE.md) kuruldu.
Yeni yerel kosumlar gunluk fixture'lardan farkli D1/portlar, rastgele sirlar ve
Android'de `.test` paketi kullanir. Native 101 ekran/akis, medya ve bildirim
testleri bu ayri pakette yeniden gecti. Yayin kapisinin negatif birim testleri
eski/eksik kanit, farkli kaynak, debug/imzasiz paket ve guvensiz yapilandirmayi
reddeder. Gercek JDK ile sentetik imzali JAR ve sonradan eklenen imzasiz girdi
kontrolu de yapildi; bu bir production AAB veya Play incelemesi degildir.
Guncel kosum raporlari `outputs/release-tests/<run>/suite-report.json` icindedir;
commit/kaynak ozeti olmadan eski kanitlar yeniden yayin onayi olarak kullanilmaz.

macOS/Xcode ve iOS simuletoru/fiziksel cihaz; fiziksel Android kamera ve izin
kenar durumlari; rizali yuzlerle pozitif eslestirme; ekran okuyucu/buyuk yazi;
staging HTTPS, gercek D1 semasi/uyelik/binding denetimi, yedek ve geri alma;
imzali release ve magaza onayi halen gereklidir. Yerel testleri bu asamalarin
yerine koyma. Is adimlari [grup rehberindedir](READING_GROUPS.md).

## Yeniden Calistirma

Testleri paylasilan ornek hesaplarda sirayla calistir. API testi parola
degistirerek eski oturumlari iptal eder; native testlerle ayni anda calistirma.
WSL2'de bellek baskisi varsa web/build kontrolleri sirasinda emulatoru kapat.
Medya testi yalniz yerel TensorFlow model agirlik onbellegini temizleyerek
soguk model yuklemesini denetler; kisiye ait fotograf veya vektor saklamaz.

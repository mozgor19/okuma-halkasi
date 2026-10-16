# Google Play yayin ve test rehberi

17 Ekim 2026. **Mevcut karar: yayina hazir degil.** Debug APK'nin calismasi,
web testleri veya JS export'un gecmesi magaza hazirligi degildir. Play Console
hesabi, staging/canli HTTPS adresleri ve imzali yayin adayi henuz yok.
Bu belge yayin yetkisi vermez; otomatik magaza yuklemesi eklenmedi.

## Kurulan test ortami

Node 24 ve sabit pnpm surumuyle repo kokunde:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install --with-deps chromium
corepack pnpm test:release:unit
corepack pnpm test:release
```

`test:release` temiz sentetik hesaplarla yeni bir yerel D1 ortami kurar. Varsayilan
portlar 5184/5185'tir; doluysa baska sunucuya baglanmak yerine durur. Gunluk
5174/5175 ortamini, mevcut kullanici verisini veya canli D1'i sifirlamaz.
Kurulan sunucular test sonunda kapatilir. `OKUMA_TEST_RUN_ID` yalniz basit bir
yerel kimlik olabilir; dosya yolu veya uzak adres verilemez.

- Veritabani ve rastgele test sirri: `.sites-runtime/release-tests/<run>/`.
- Raporlar ve ekran goruntuleri: `outputs/release-tests/<run>/`.
- Ana rapor: `suite-report.json`; commit, kaynak SHA256, temiz/kirli calisma
  durumu, baslangic/bitis ve her komutun sonucu bulunur.
- Ayni fixture'lari kullanan testler sirayla calisir. Yerel SQLite dosyasina
  farkli sunuculardan eszamanli yazma test sonucu degildir; kilit hatasi yaratabilir.
- Yalniz loopback, sabit sentetik D1 kimlikleri ve `--local` kullanilir.
  Cloudflare anahtari gerekmez; test alt sureclerine Cloudflare API sirri aktarilmaz.

Otomatik web kapisi: yayin-kapisi birim testleri, backend izolasyon/yetki,
native kopru politikasi, web/mobil TypeScript, tema/kontrast sozlesmesi, lint,
uretim web build, gercek yerel D1 API'leri, 193 ekran kontrolu, grup adi/uzun
metin kontrolleri, bayrak kapali eski web ve uyelik iptal/geri alma akislaridir.
API testi parolayi degistirerek eski test oturumlarini iptal eder; native
testlerle ayni ortamda ayni anda calistirilmaz.

## Android otomasyonu

JDK17, Android SDK36, emulator, KVM ve Node24 gerekir. Ayrintilar
[Android rehberinde](MOBILE_ANDROID.md). Once yalniz test emulatorunu ac:

```bash
corepack pnpm test:release:android
```

Komut yalniz `emulator-*` seri numarasini kabul eder. `OKUMA_ANDROID_SERIAL`
ile baska emulator secilebilir. `com.okumahalkasi.app.test` adli ayri uygulama
uretilir; normal uygulamanin verisine yazilmaz. Expo native proje uretilir,
native sablon SDK ile uyumlu kesin surume (`android-policy.json`) sabitlenir;
paket degisiminden kalan yalniz uretilmis autolinking onbellegi yenilenir.
x86_64 debug APK derlenip kurulur; 5184 backend ve ayri 8083 Metro baslatilir.
101 ekran/native akis kontrolu, medya/ZIP/yerel yuz modeli negatif testi ve
bildirim ret/onay/soguk acilis testleri sirayla kosulur. Sunucu ve Metro kapanir;
emulatoru kullanici yonetir. Test APK'si bir magaza paketi degildir.

`mobile/android` uretilen ve Git disi bir klasordur. Test prebuild'i onu test
paketine gore gunceller. Elle native degisiklik varsa once ayri checkout kullan;
script `--clean` veya kullanici dosyalarini silen bir islem yapmaz.
Test uygulamasinin bildirim gecmisi sifirlanir; fiziksel telefona bu komutu verme.
Dusuk bellekli WSL ortaminda once web testlerini bitir, sonra emulatoru ac.

## GitHub'da zorunlu kapilar

`.github/workflows/release-tests.yml`, PR, main push ve manuel calistirmada ayri
Ubuntu islerinde web/backend ve Android emulator testlerini kosar. Action'lar
sabit commit'lere baglidir; bagimlilik kurulumu frozen lockfile kullanir.
Sirlar, D1 dosyalari, sunucu loglari ve test parolalari artifact olarak yuklenmez.
Yalniz sentetik goruntuler/JSON raporlar 14 gun saklanir. Hata/iptal de basarisizdir.

Repo yoneticisi GitHub Settings > Rules > Rulesets altinda `main` icin:

1. PR ve review zorunlu olsun; dogrudan push/force-push ve yetkili bypass kapatilsin.
2. `Release Regression Gate` gerekli status check olsun; merge oncesi dal guncel olsun.
3. Workflow, `release/`, yayin scriptleri ve izin degisiklikleri ozellikle incelensin.
4. Ileride yayin otomasyonu eklenirse Play servis hesabi yalniz reviewer onayli,
   main ile sinirli `google-play-production` environment icinde bulunsun.
   Fork PR'larinda `pull_request_target` ile kod calistirma veya sir verme.

**Workflow eklemek GitHub ruleset'ini otomatik etkinlestirmez.** Bu sunucu
ayari burada degistirilmedi. CI'nin uzak kosumu ilk push'tan sonra kontrol edilmeli.
Cloudflare veya baska bir hizmet Git push'undan dogrudan canliya otomatik deploy
yapiyorsa, bu yolu da kapat veya ayni basarili kapinin arkasina al. GitHub check'i
tek basina bagimsiz bir hosting servisinin otomatik yayinini durdurmaz.
Play Console'da manuel yukleme yapan bir yoneticiyi yerel script engelleyemez;
yayina erisim izinleri ve ekip sureci de bu kapilari zorunlu tutmalidir.

## Gercek yayin adayi kapisi

```bash
corepack pnpm release:check
```

Bugun `not-ready` ve cikis kodu 1 beklenir. JSON/Markdown karar raporu
`outputs/release-readiness/` altindadir. Bu, test arizasi degil eksik yayin
kanitlarini reddeden kasitli davranistir.

Yayin adayi oldugunda `release/android-evidence.example.json` biciminde Git disi
bir kanit dosyasi hazirlanir. Ust alanlar bu surumun commit'i, kaynak ozeti,
AAB SHA256'si, upload sertifikasi SHA256'si, gercek HTTPS origin'i ve
versionCode bilgisidir. `approvals`, `release/android-policy.json` icindeki her
manuel kontrol icin su bicimde kayit ister:

```json
{
  "staging": {
    "status": "passed",
    "by": "Onaylayan kisi",
    "at": "2026-10-17T12:00:00Z",
    "evidence": "Dahili test raporu veya is takip baglantisi"
  }
}
```

Gercek onay alinmadan `passed` yazma; kullanici/parola/cerez, ham biyometrik
veri veya upload anahtarini bu dosyaya ekleme. Kaniti imzali AAB'nin tam hash'i
icin topla; farkli build olusturursan onaylari yeniden al.

```bash
corepack pnpm release:check \
  --evidence .sites-runtime/release/candidate.json \
  --web outputs/release-tests/WEB_RUN/suite-report.json \
  --android outputs/release-tests/ANDROID_RUN/suite-report.json \
  --bundle /guvenli/yol/app-release.aab \
  --bundletool /guvenli/yol/bundletool.jar
```

`bundletool`, Google'in [resmi aracidir](https://developer.android.com/tools/bundletool).
Guvenilir surumu indirip hash'ini dogrula; JDK'nin `java`, `jarsigner` ve `keytool`
araclari PATH'te olsun. Script gercek AAB'yi acar, imzayi ve beklenen upload
sertifikasini denetler; debug imzasini reddeder. Manifestte paket/versionCode,
API seviyesi, debug/test modu, yedekleme, cleartext ve yasak izinler denetlenir.
ARM64 kutuphaneleri ve butun ARM64 ELF LOAD segmentlerinin 16 KB hizalamasi
kontrol edilir. Adayin HTTPS origin'i native bundle'da bulunmalidir.
ELF kontrolu ZIP hizalamasini veya 16 KB cihazda calismayi kanitlamaz; bunlar
ayri manuel kabul ister. AAB yokken bu inceleme yapilmis sayilmaz.

Eksik/adimi basarisiz, farkli commit/kaynak, kirli checkout veya 14 gunden eski
rapor gecmez. Uc aylik politika inceleme tarihi gecerse kapi kapanir. Test sirasinda
kaynak degisirse kosum basarisiz olur. Kod commit edildikten sonra temiz checkout'ta
tekrar kosulmadan gelistirme raporu yayin kaniti sayilmaz. `ready-for-manual-submission`
yalniz teknik kapinin gectigidir; Google incelemesini/onayini garanti etmez.

## Bugunku yayin engelleri

| Alan | Bugunku durum / gereken |
| --- | --- |
| Play Console ve kimlik | Hesap yok; hesap sahibi/kurulus ve paket sahipligi netlesmeli |
| HTTPS backend | Staging/canli adres yok; ayri Worker/D1'ler ve sirlar gerekir |
| Veritabani | Uretim `0000`-`0008` tablo/alanlari, binding ve aktif uyelikler dogrulanmadi |
| Imzali AAB | Yok; mevcut uretilen Gradle release blogu debug imzasi kullaniyor; onu yayinlama |
| Cihaz kabul | ARM64 fiziksel telefon, imzali adayi guncelleme ve 16 KB runtime bekliyor |
| Fiziksel form/izinler | Kamera, butun roller/komutlar, izin/ag kenarlari, TalkBack/buyuk yazi bekliyor |
| Gizlilik | Uygulama ici ve herkese acik gizlilik metni/destek adresi eksik |
| Veri haklari | Hesap/veri silme talebi ve tum gruplarda silme/saklama sureci eksik |
| Kullanici icerigi | Yorum/fotograf icin kosullar, kullanici/icerik raporlama ve moderator is akisi eksik |
| Yuz verisi | Riza metni/kayit kaniti, geri cekme, pozitif cihaz testi ve hukuki inceleme bekliyor |
| Play beyanlari | Data safety, hedef kitle, icerik derecesi, inceleyici erisimi ve pre-launch raporu yok |
| Operasyon | Yedek/restore provasi, alarmlar, olay/geri alma plani dogrulanmadi |

Kapali okuma grubu olmasi kullanici icerigi politikasini otomatik kaldirmaz:
sinirli/dogrulanmis kullanici topluluklarinda da uygulama ici icerik ve kullanici
raporlama gerekir. Yalniz yoneticinin fotograf silebilmesi bunun yerine gecmez.
[Google UGC politikasi](https://support.google.com/googleplay/android-developer/answer/9876937).

Su anda genel hesap olusturma akisi yok. Google'in hesap silme zorunlulugunun
kapsami uygulama icinden veya uygulamanin yonlendirdigi hesap olusturma akisina
baglidir; bunu Console'da dogru beyan et. Buna ragmen urun kabul kriterimiz veri
silme talebi ve uygulanabilir saklama politikasidir. Oturum kapatma/uyelik iptali
veri silme degildir. [Resmi hesap silme aciklamasi](https://support.google.com/googleplay/android-developer/answer/13327111).

## Hesap, imzalama ve yayin sirasi

1. Gercek sahip adina Play Console hesabi ac, kimlik/iletisim dogrulamasini tamamla.
   Kisisel/kurulus tipini gercek durumuna gore sec. Google'in kayit bedeli bugun
   bir defalik 25 ABD dolaridir; odeme ekranini yeniden kontrol et.
   [Resmi hesap kaydi](https://support.google.com/googleplay/android-developer/answer/6112435).
2. Ayri staging ve canli Worker/D1'leri kur. Ozel alan adi sart degil; Cloudflare'in
   HTTPS `workers.dev` adresi de kullanilabilir. Yerel 127.0.0.1 veya gecici
   emulator baglantisini Play inceleyicisine verme.
3. Uretim yedegini ve mevcut semayi denetle; SQL'i korlemesine calistirma.
   [Grup gecis runbook'u](READING_GROUPS.md) uyarinca staging'de prova yap.
4. Gizlilik, destek, veri silme ve UGC akislarini uygula; veri sorumlusu ve
   saklama/yurt disi aktarim kararlarini netlestir. [Veri rehberini](USER_DATA.md) kullan.
5. Expo/EAS hesabini kendi kurulusunda bagla. `mobile/eas.json` staging icin ayri
   `.staging` paketli APK, production icin AAB tanimlar. Her ortamda
   `EXPO_PUBLIC_APP_URL` yalniz o ortamin HTTPS origin'i olsun; bu public bir
   adrestir, sir koyma. `eas build:configure` ile gercek proje baglantisini kur;
   bu dosya tek basina EAS hizmetini veya anahtari kurmus olmaz.
6. Once staging APK'sini gercek telefonda dene. Sonra ayni kaynak surumunden
   production AAB uret, versionCode'u her yuklemede arttir. EAS'in guvenli
   credential yonetimini veya korunan yerel upload key'i kullan. Debug keystore
   kullanma; anahtar/parolalari Git'e koyma. Google Play App Signing dagitim
   anahtarini yonetir; upload key farklidir. Sertifika yedegi/erisim sorumlusu belirle.
   [Resmi paket/imza sureci](https://developer.android.com/studio/publish/upload-bundle).
7. Magaza aciklamasi, ikon/telefon ekran goruntuleri, destek ve gizlilik URL'si,
   Data safety, hedef kitle/reklam/icerik derecesi ve App access bolumlerini doldur.
   Inceleyiciye kisisel veri icermeyen, suresi dolmayan test hesabi ve grup/rol
   talimati ver; gercek uyelerin parolasini paylasma.
8. Internal testing'de AAB'yi dene ve Play'in uretecegi APK'yi kontrol et.
   Yeni kisisel hesaplarda production erisimi oncesi en az 12 test kullanicisinin
   14 gun kesintisiz closed test'e katilmis olmasi ve erisim basvurusu gerekir.
   Kurulus hesabina ayni kuralin otomatik uygulandigini varsayma; Console'u izle.
   [Resmi test kosulu](https://support.google.com/googleplay/android-developer/answer/14151465).
9. Pre-launch raporundaki cokme/ANR/erisilebilirlik sorunlarini kapat. Ayni
   AAB hash'i icin manuel kanitlari topla, iki otomatik suite raporuyla
   `release:check` calistir. Kapi yesil ve yetkili insan onayi olmadan gonderme.
10. Once kontrollu yayin yap; Play destekliyorsa kademeli dagit, aksi halde
    internal/closed test kapsamini genisletip sonra production'a gec. Android
    vitals, Worker hata orani, D1 kota/boyut ve kullanici taleplerini izle.
    WebView arayuzu sunucudan geldigi icin web backend yayinlari da mobil
    kullaniciyi etkiler; onlar da ayni regresyon/staging surecinden gecmelidir.

31 Agustos 2026 sonrasi yeni telefon uygulamalari/guncellemeleri icin hedef API
en az 36'dir. [Resmi hedef SDK kurali](https://developer.android.com/google/play/requirements/target-sdk).
Native kutuphaneler icin 16 KB uyumlulugu da ayrica gerekir.
[Resmi 16 KB rehberi](https://developer.android.com/guide/practices/page-sizes).
Tarih/kurallar degisebilir; her yayin oncesi Console uyarilarini ve politika
inceleme tarihini yenile. Bir WebView kabugu olmak inceleme muafiyeti degildir.

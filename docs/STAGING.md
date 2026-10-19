# Koru Cloudflare test ortami

Yalniz `koru-staging.mustafayapayzeka.workers.dev` ve bes `koru-staging-*` D1'i
icin operator aracidir. Canli Worker veya DB migration/deploy araci degildir.
Workers Free kullanilir; kod abonelik veya ucretli kaynak olusturmaz.
Mevcut ucretsiz kotalar hesap genelinde ortaktir.

## Guvenlik ve kapsam

- Test DB kimlikleri `scripts/staging-policy.mjs` icinde acikca sabittir.
  Kaynak kimlikleri sir degildir. API tokeni yalniz Wrangler oturumundan bellege
  alinir; dosyaya, loga veya rapora yazilmaz.
- Her DB'nin adi, kimligi ve Worker binding'i yazmadan once dogrulanir.
  Bos olmayan tanimsiz DB'ye dokunulmaz. Reset, drop veya canli kopyalama yoktur.
- Kanonik DB `0000`-`0010`; dort grup DB'si `0000`-`0007` ve `0010` kullanir.
  Migration dosyalari degistirilmez. Ek `staging_environment` tablosu Worker,
  binding, sema ozeti ve hazirlik durumunu kaydeder. Yarim/degismis kurulum
  otomatik devam etmez; operator incelemesi gerekir.
- Tamamlanmis kurulum tekrar calistirilinca mevcut veri korunur. Migration
  degisikligi icin ileride ayri, yedekli migration sureci gerekir.
- Iki sentetik hesap ve iki sentetik okuma grubu vardir. Iki ek DB yeni grup
  olusturma icin bosta hazirlanmistir; onceki fixture gruplari yeniden atanmaz.
  Gercek topluluk, ucuncu kisi, fotograf veya canli veri alinmaz. Isletmecinin
  Gmail kutusu yalniz kendi hesap akislarini dogrulamak icin kullanilir.
  Grup yerel uye numaralari bilerek farklidir.
- `koru.coklu` iki gruptadir: ilkinde ana yonetici, ikincisinde katilimci.
  `koru.tek` yalniz ilk gruptadir ve katilimcidir.
- Parolalar rastgeledir; DB'de uygulamanin PBKDF2-SHA256 sozlesmesiyle hashlenir.
  Yerel parola/session dosyasi `.sites-runtime/koru-staging/credentials.json`
  altinda (dizin 0700, dosya 0600) ve Git disidir. Paylasma/artifact'e ekleme.
  Yerel dosya kaybolursa mevcut hesaplar otomatik sifirlanmaz.
- `SESSION_SECRET` ve Turnstile secret'i yalniz Worker Secret'idir. Vite ciktisi
  ve dagitim JSON'una konmaz. Site key gizli degildir.
- Test ortami HTTP uzerinden anonim olarak acilabilir; ozel uygulama verisi
  giris gerektirir. Cloudflare Access eklenene kadar gercek veri kullanma.
  Noindex basligi erisim kontrolu degildir.
- Varsayilan `SELF_SERVICE_ENABLED=false`, `SELF_SERVICE_LOCAL=false`.
  `staging:prepare --onboarding` yalniz kisitli denemeyi acar; deploy araci
  Gmail kurulumunu, operator Gelen Kutusu teyidini ve guncel yetkiyi denetler.
  `SELF_SERVICE_TEST_EMAILS` yalniz Worker Secret'idir; eksik/bozuksa staging
  kapali kalir. Izin verilen adresler sadece `koru.destek@gmail.com`,
  `koru.destek+deneme1@gmail.com`, `koru.destek+deneme2@gmail.com` olur.
  +adresler ayni Gelen Kutusu'na gelir; yeni Google hesabi acilmaz. Bu izin
  listesi wildcard/alan adi izni vermez ve tarayici config'ine acilmaz.
  Gmail sirri yalniz staging Worker
  Secret'idir; gonderme yetkisi en fazla 7 gun gecerlidir. Node'daki tek posta
  denemesi Worker'da kayit/kurtarma kabulunun yerine gecmez.
  Yerel posta bypass'i internete tasinmaz. Yeni grup kurma akislarini
  yerel `self-service:dev` / `test:release` ortami test etmeye devam eder.
- `/privacy`, `/terms`, `/support` Mustafa Ozgor ve destek Gmail bilgileriyle
  deneme kapsamini, veri envanterini ve acik yayin engellerini belirtir.
  Bunlar avukat incelemesi veya KVKK uygunluk onayi degildir. Kosul kabulunu
  biyometrik isleme/yurt disi aktarim icin genel riza gibi kullanma.
- Koru urun adidir. Giris sonrasi basliklar secilen okuma grubunun adi olarak
  kalir; gruplara ozel roller ve dort tasarim semasi korunur.

## Komutlar

Gmail gonderici hesabinin yerel OAuth baglantisi icin [GMAIL_SETUP.md](GMAIL_SETUP.md)
kullanilir. Bu baglanti tek basina posta gonderimini veya kayit akislarini acmaz.

Node 24 ve ayni hesaptaki `wrangler login` oturumu gerekir.

```bash
corepack pnpm staging:status
corepack pnpm staging:init --confirm=koru-staging
corepack pnpm build
corepack pnpm staging:prepare
corepack pnpm staging:deploy --confirm=koru-staging
```

Kisitli kayit/davet/grup kurma/sifre yenileme testini acmak icin normal
`prepare` yerine `corepack pnpm staging:prepare --onboarding` kullanilir.
Kapatmak icin normal `prepare` ve ayni staging deploy komutu kullanilir.
Her iki modda da public host icin gercek Turnstile kullanilir; dummy anahtar
veya agdaki tokenleri DB'ye kaydetme gibi bir kestirme yoktur.

Iki yeni havuz DB'si bir defaya mahsus `scripts/staging-pool.mjs` ile ucretsiz
10 DB siniri icinde olusturuldu ve kimlikleri kaynak politikasina sabitlendi.
Bu komut genel otomatik kapasite araci degildir. Icerigi olan DB'yi silmez,
sifirlamaz veya benimsemez. Grup kurulduktan sonra tekrar bootstrap yapma.
Kapasite tukendiginde uygulama 503 verir; mevcut gruplari yeniden kullanma.

`init` yalniz bir kez bos DB'lere sema ve sentetik fixture kurar. `prepare`
normal build ciktisindan, yalniz izin verilen alanlari kopyalayarak ayri bir
`.sites-runtime/koru-staging/wrangler.json` hazirlar. Normal build/deploy ayarlari
degismez. Uretilen `dist/server/wrangler.json` dogrudan deploy edilmez: normal
web DB'sine ait binding icerir. Test dagitimi icin sadece `staging:deploy` kullan.

`deploy` hedefleri yeniden dogrular; test session secret'ini sunucuya ekler,
once dry run yapar ve yalniz test Worker'ini yukler. Turnstile secret'i
Cloudflare'da korunur. Runtime bayraklari ve baglantilar sonradan yeniden okunur.

Test parolasini sadece kendi terminalinde gor:

```bash
corepack pnpm staging:credentials
```

HTTPS staging kabul testi:

```bash
corepack pnpm staging:test
```

Bu test yalniz sabit test adresine gider; sentetik hesaplarla giris/grup degisimi,
yetki ve veri izolasyonunu, kisitli test konfigurasyonunu, gercek Turnstile
zorunlulugunu, hukuki sayfalari ve dort semayi
390px / 1440px, acik / koyu modda kontrol eder. Notebook profilinin tum sekmeleri
dahildir. Test sonunda gorunum notebook/light'a geri alinir. Parola/oturum
dosyasi rapora konmaz. Ekran goruntuleri ve sonuc `outputs/koru-staging/` altindadir.

Onceki kapali staging HTTPS kabulunde 14 akis/guvenlik kontrolu ve 92 ekran goruntusu
gecti. Bu sonuc gercek e-posta teslimati, yeni uyelik/grup kurma veya native
Android/iOS kabulunu kapsamiyor. Kayit/grup kurma/davet akislarinin yerel
regresyon testleri ayri `test:release` kapisinda calisir.

## Gercek posta icin manuel kabul

1. Staging `/register` adresinde izinli kendi e-postanla, benzersiz kullanici adi
   ve guclu sifreyle kaydol; Turnstile'i tamamla. Baskasinin e-postasini kullanma.
2. Gelen Kutusu/Spam'deki dogrulama baglantisini kendi tarayicinda ac ve
   E-postami dogrula dugmesine bas; baglantiyi/kodu sohbete veya rapora koyma.
3. Giris yap; grup yoksa yonetim ekranini, grup kurduktan sonra dogrudan ana
   ekrani dogrula. Ayni olusturma istegini yinelemek ikinci grup yaratmamali.
4. Ikinci izinli +adresle ayri test hesabi ac; birinci gruptan davetle katil.
   Rol uye olmali; baska gruba davetsiz erisememeli. Ikinci grup, roller,
   gorunum ve profil uzerinden gecisi ayri dogrula.
5. Sifremi unuttum ile gercek e-postayi al; baglantiyi kendi tarayicinda ac.
   Yeni sifreyle giris, eski sifrenin reddi ve eski oturumun iptalini dogrula.
6. Gelen Kutusu/Spam sonucu, tarih ve akisin sonucu disinda token, sifre,
   e-posta govdesi veya ham HTTP izi rapora koyma. Google gonderim kabulunu
   alicida dogrulanan teslimat yerine sayma.

HTTPS mail kabulunden once genel kullanima acma. Kalici posta, hesap silme ve
disari aktarma, biyometrik riza, UGC raporlama, saklama/yedek donus provasi,
yurt disi aktarim ve uretim migration incelemesi yayin engeli olmaya devam eder.
Play Console/imzali AAB/fiziksel Android ve iOS testleri ayrica gereklidir.

Kaynaklar: [D1 ucretsiz limitler](https://developers.cloudflare.com/d1/platform/limits/),
[D1 fiyatlandirma](https://developers.cloudflare.com/d1/platform/pricing/),
[KVKK aydinlatma](https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-).

Bu ciktiyi destek mesajina veya Git'e koyma. Normal CI bu komutu calistirmaz.
Staging scriptlerinin unit testleri normal release unit test kapisina dahildir.
Gercek HTTPS kabul sonucu ayri raporlanir; yerel web/native testin yerine gecmez.

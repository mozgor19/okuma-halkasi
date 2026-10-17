# Web kayit ve grup yonetimi

17 Ekim 2026. Once web icindir. Canli SQL/deploy, gercek e-posta gonderimi veya
yeni native Android/iOS kabul testi yapilmaz. Marka adi henuz kararlastirilmadi;
secili okuma grubunun adi uygulama markasindan ayri kalir.

## Yerel deneme

```bash
nvm use 24
corepack pnpm self-service:dev
```

Adres: http://127.0.0.1:5184/register. Komut kendine ait `self-service-web` isimli
yerel ortam kurar; mevcut 5174 verisini tasimaz, silmez veya migrate etmez.
5184 doluysa durur. Daha once kurulmus ortamin semasi eskiyse veriyi silme;
sema kontrolu yap veya yeni `OKUMA_TEST_RUN_ID` ile ayri ortam kullan.

Ayar/veri `.sites-runtime/release-tests/self-service-web/` altindadir (Git disi).
`demo.multi`, `demo.single`, `demo.none` orneklerinin rastgele parolasi oradaki
`groups-development.json` dosyasindadir. Yeni bir hesapla da kaydolabilirsin.
Yerelde uydurma bir e-posta adresi kullan; disariya posta gonderilmez.
Posta kutusu yalniz yerel komut satirindan okunur; HTTP e-posta endpoint'i yoktur:

```bash
corepack pnpm self-service:mail
```

Ciktidaki dogrulama baglantisini acip dugmeye bas. Linkler sir sayilir;
ekran goruntusu, destek mesaji, log veya Git'e koyma. Yerel bypass yalniz HTTP
loopback ve acik sunucu bayraklariyla calisir; public hostta kullanilamaz.

## Akislar

1. `/register`: ad, benzersiz kullanici adi, e-posta, sifre ve kosul kabulunu alir.
   E-posta dogrulanana kadar aktif hesap yaratmaz. Link 30 dakika/tek kullanimdir.
2. Kullanici adi ve sifreyle giris yapilir. Uyelik yoksa `/groups` ve Grup kur
   veya katil; tek grupta dogrudan uygulama; cok grupta her yeni giriste secim acilir.
3. `/groups/manage` yeni grup kurar veya mevcut grubu acar. Kurucu yalniz yeni
   grubunda ana yoneticidir. Diger gruplardaki rol/gorunum/icerik degismez.
4. Profilde Grup degistir ve Gruplarimi yonet vardir. Tek gruplu kisi de baska
   grup kurabilir veya davetle katilabilir.
5. Yoneticiler profilden davet olusturur/iptal eder. Kod veya `/join#invite=...`
   paylasilir. Giris/kayit gerekirse davet ayni tarayici sekmesinde korunur;
   baska cihazda e-posta acilirsa kod tekrar yapistirilabilir.
6. Davet 1-30 gun, 1-100 kisi; varsayilan 7 gun/10 kisidir. Katilan her zaman
   katilimcidir. Son yer atomik ayrilir. Iptal edilmis uyelik davetle acilmaz;
   kontrollu yonetici sureci gerekir. Grup basina en fazla 20 aktif davet vardir.
7. `/forgot-password`: dogrulanmis adrese 15 dakikalik tek kullanimli link.
   Yenileme tum eski oturumlari ve ayni surumdeki diger yenileme linklerini iptal eder.
   Normal sifre degisimiyle eszamanli yarista surum geri alinamaz; eski parola
   kaydi degismisse normal guncelleme compare-and-swap ile reddedilir.
8. Eski hesap `/account` uzerinden mevcut sifreyle e-posta ekler; hesap tasinmaz.
   Ad/e-posta benzerligiyle hesap birlestirilmez. Dogrulanmis e-posta olmadan
   yeni grup/davet kurulamaz veya davete katilinmaz; mevcut grup girisleri korunur.
9. `/support` yapilandirilan destek adresine baglanir. Gercek posta kutusu veya
   ticket sistemi yaratmaz; adres eksikse bunu acikca gosterir.

## Guvenlik

- `SELF_SERVICE_ENABLED=true` ve `READING_GROUPS_ENABLED=true` birlikte gerekir;
  varsayilan kapali. Yeni akislari mevcut webde habersiz acmaz.
- JSON govde 8 KiB; ayni Origin, cross-site ret; HttpOnly/SameSite/Secure oturum;
  grup yazmalarinda mevcut `X-Reading-Group` denetimi korunur.
- Sifre mevcut PBKDF2-SHA256/rastgele salt sozlesmesiyle hashlenir; duz metin
  saklanmaz. 12-200 karakter, harf/rakam ve kullanici adi denetimi vardir.
  Is faktoru Workers uyumlulugundan mirastir; algoritma/is-faktoru ve ihlal
  edilmis parola kontrolu canli guvenlik incelemesinde ayrica degerlendirilmelidir.
- D1 uzerinde atomik IP/kullanici/e-posta deneme sinirlari; anahtarlar HMAC'tir.
  Ham IP/e-posta rate tablosuna yazilmaz. Cloudflare disinda client-IP basliginin
  taklit edilemeyecegi guvenilir proxy konfigurasyonu ayrica gereklidir.
- Kayit/kurtarma yaniti hesap varligini soylemez. Uretimde mail saglayici
  gecikmesi `after()/waitUntil` ile yanittan ayrilir; genel basarili yanit en az
  500 ms bekler. Bu bagimsiz zamanlama/penetrasyon testi garantisi degildir.
- Turnstile sunucuda basari, hostname ve action ile dogrulanir; servis yoksa
  fail-closed. Gizli anahtar tarayiciya veya mobil pakete verilmez.
- Dogrulama/davetler 256-bit rastgeledir; asil tabloda sadece SHA256 ozeti vardir.
  E-posta govdesi ve yerel posta kutusu aliciya giden asil tokeni icerir.
  URL fragment'i HTTP access loguna/Referer'a gitmez; okununca temizlenir.
  GET link taramasi hesap/uyelik yaratmaz; acik POST onayi gerekir.
- Private/no-store, no-referrer, nosniff, frame engeli ve Turnstile CSP'si;
  Vite dosya sunucusunda yerel DB, ayar, log ve rapor klasorleri engellenir.
- Davet kodu sadece olusturma yanitinda vardir. Liste/iptal, her istekte secili
  grup ve yerel yonetici rolunu denetler; kod/ozet liste API'sinde yoktur.

## D1 Havuzu

Kanonik `DB` hesap/e-posta/token ozetleri/grup registry'sini tutar. Ek gruplarin
domain verisi ayri D1'lerde kalir. Kimligi olup default uyeligi olmayan hesap
default uye listesine sizmaz. Mevcut kayit numaralari degismez.

Istekte Cloudflare yonetim anahtariyla DB/deploy yaratilmiyor. Hazir, bos,
migration uygulanmis binding havuzu kullanilir. `SELF_SERVICE_GROUP_BINDINGS`
havuzdur; her binding ayrica `READING_GROUP_DB_BINDINGS` allowlist'inde olmalidir.
Atanmis veya domain verisi bulunan DB yeniden kullanilmaz; migration'in
`book_vote_visibility=open` fabrika ayari bos DB kontrolunun disindadir.
DB icindeki tek sahip kaydi, farkli binding alias'larinin ayni fiziksel DB'yi
iki gruba vermesini de engeller. Self-service grubunun her erisiminde bu sahiplik
yeniden dogrulanir; sonradan yanlis DB'ye baglanirsa veri acilmaz. Kapasite yoksa
503 doner; baska grubun verisine dusmez. Gelistirmede uc bos DB vardir; urun
toplam uc gruba sabit degildir. Operator kapasite/kota/alarm ve artisi yonetir.
Hesap basina uc kurulan grup ve 20 davetle uyelik abuse siniri vardir.

DB'ler arasi dagitik transaction yoktur: kanonik rezervasyon, domain uye/link
transaction'i, kanonik aktif uyelik asamalari vardir. `group_provisioning` ve
`group_invitation_redemptions` yarim islemi gorunur/retry-safe tutar;
`group_account_links` ikinci yerel uye yaratilmasini onler. Kanonik aktif uyelik
bitmeden veri erisimi verilmez. Yarim davet rezervasyonu kota tuketir; havuz
otomatik silinmez/yeniden atanmaz. Takilan kayit operator tarafindan incelenir.

Migration: `0009_self_service.sql` yalniz kanonik DB; `0010_group_account_links.sql`
her domain DB (default dahil). `0008` once kurulmus olmali. Bos havuz DB'leri
`0000`-`0007` ve `0010` domain semasini seeded veri olmadan kullanir; ek DB'ye
kanonik parola/hesap kaydi tasinmaz. Canliya yerel setup/demo SQL uygulama.

## Canli E-posta

Gercek destek kutusu, alan adi, Resend/Turnstile hesabi kod tarafindan acilmadi.
Marka/alan adi kararlastiktan sonra:

1. Gercek gelen kutusu olan destek adresini kur; MFA/yetkileri ayarla. Otomatik
   posta gonderim servisi tek basina destek gelen kutusu degildir.
2. Resend gonderici alan adini dogrula; DNS/SPF/DKIM/DMARC ve posta almayi test et.
   Auth postalarinda link/acilma takibini kapat. API key yalniz ilgili alan
   adinda gonderim yetkisiyle sinirli olsun.
3. `AUTH_PUBLIC_ORIGIN` (tam HTTPS origin), `APPLICATION_BRAND`, `SUPPORT_EMAIL`,
   `MAIL_FROM` (yalin e-posta), `PRIVACY_POLICY_URL`, `TERMS_URL`,
   `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY` sunucuda ayarlanir.
   Sirlar Worker Secret'tir, repoya/pakete konmaz. Canlida `SELF_SERVICE_LOCAL` kapali.
4. Staging ve canli icin ayri DB/anahtar/gonderici kullan; gercek posta, bounce,
   spam, kesinti, rate-limit ve parola kurtarmayi HTTPS staging'de kabul et.
   Gonderim uc kez idempotent denenir; kalici kuyruk degildir. Son hata sanitize
   edilmis loga gider. Operator alarmi ve yeniden gonderim/olay sureci zorunludur.
5. Gercek veri sorumlusu ile gizlilik, kullanim kosullari, destek, saklama/silme
   sureclerini hazirla. Sema/yedek, staging ve bagimsiz guvenlik kabulunden sonra
   bayragi kontrollu ac. Bu belge canli yayin veya SQL uygulama izni degildir.

## Test Kapisi

`corepack pnpm test:release` eski web matrisine ek olarak self-service modunda
gercek yerel D1/Playwright akislarini calistirir. Yeni `self-service` adimi
`release:check` icin zorunludur. Posta kutusu/sirlar artifact'e yuklenmez.
Origin/govde/parola, dogrulama/kurtarma, eski hesap e-posta ekleme, bos/tek/cok
grup, eszamanli son yer, retry, yetki/izolasyon, iptal/sure/pasif uyelik,
kapasite ve dort semanin iki modu kapsanir. Gercek posta ve yeni native kabul
yerel web testi yerine sayilamaz.

Kaynaklar: [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/),
[Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[OWASP kurtarma](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html),
[Resend API](https://resend.com/docs/api-reference/emails/send-email).

# Koru staging Gmail yetkilendirmesi

Bu arac yalniz operatorun `koru.destek@gmail.com` gonderici hesabini baglamak
icindir. Uygulama kullanicilarinin Google hesaplarina erisim istemez; Google ile
giris ozelligi degildir. OAuth komutu ucretli kaynak, Cloudflare deploy veya posta
gonderimi yapmaz. Ayri install/test komutlari asagidadir. Hicbiri kayit, davet,
yeni grup ve sifre sifirlama bayraklarini acmaz.

## Google Console

1. Koru Mail projesinde Gmail API etkinlestirilir; faturalandirma acilmaz.
2. Google Auth Platform'da External hedef kitle ve Testing durumu kullanilir.
   Destek/iletisim adresi ve tek test kullanicisi `koru.destek@gmail.com` olur.
3. Data Access'te yalniz `https://www.googleapis.com/auth/gmail.send` secilir.
   Posta okuma/degistirme/silme izni eklenmez.
4. Clients'ta Web application turunde `Koru Staging Mail` olusturulur.
   JavaScript origins bos kalir. Redirect URI aynen su olur:
   `http://127.0.0.1:53682/oauth/callback`.
5. Olusturma ekranindan JSON indirilir; kaynak koduna/Git'e veya sohbete konmaz.
   JSON'daki client secret olusturma aninda guvenli bicimde saklanmalidir.

## Yerel baglanti

Node 24, yerel tarayici ve bos 53682 portu gerekir. JSON indirme klasorunde
kalabilir. WSL'deki `\\wsl.localhost\Ubuntu\home\mustafa\Downloads` yolunun
Linux karsiligi `/home/mustafa/Downloads` olur.

```bash
nvm use 24
corepack pnpm staging:mail:authorize /home/mustafa/Downloads --check
corepack pnpm staging:mail:authorize /home/mustafa/Downloads
```

Klasorde birden fazla uygun JSON varsa komuta tek dosyanin tam yolu verilir.
`--check` yalniz JSON turu/donus adresini dogrular; Google'a baglanmaz, sunucu
baslatmaz, anahtar yazmaz. Dosya icerigi veya anahtar terminale basilmaz.

Normal komut terminalde tek kullanimlik yerel adres gosterir. Adres ayni
bilgisayardaki tarayicida acilir; yalniz `koru.destek@gmail.com` ve posta gonderme
izni secilir. Beklenmeyen uygulama/hesap veya ek yetki varsa devam edilmez.
Tarayici/donus adresi paylasilmaz; kod ve state icerir. Komut tarayicinin Google
girisini otomatiklestirmez. Iptal icin Ctrl+C, sure asimi 10 dakikadir.

Google donusu state, PKCE S256 ve HttpOnly/SameSite=Lax yerel tarayici cookie'si
ile baglanir. Sunucu yalniz 127.0.0.1'de dinler; Host, GET, tek kod ve tek state
zorunludur. Tekrar/paralel donus token degisimini tekrarlamaz. Google istemci
kutuphanesiyle tokenin istemcisi, suresi ve tam send-only kapsami dogrulanir.
Saglayici hata govdeleri, kodlar ve tokenlar loglanmaz.

Yetki `.sites-runtime/koru-staging/gmail-authorization.json` altina kaydedilir:
dizin 0700, dosya 0600, Git/HTTP/build disinda. Access token saklanmaz; client
secret ve refresh token sir kabul edilir. Var olan dosya uzerine yazilmaz;
yenileme/iptal islemi operator incelemesi gerektirir. JSON'un indirme klasorundeki
kopyasi da sir kabul edilir; bulutla paylasilan klasore veya destek ekine konmaz.

`login_hint` hesap kimligini zorunlu kilmaz. Google send-only token bilgisinde
e-posta kimligi donmezse `senderVerified=false` kaydedilir. Gonderici dogrulandi
iddiasi yapilmaz; gercek posta entegrasyonu ve kontrollu teslimat testinde
From/hesap eslesmesi ayrica dogrulanmadan kayit acilmaz.

## Worker'a baglama ve kontrollu posta testi

```bash
corepack pnpm staging:mail:install --confirm=koru-staging
corepack pnpm staging:mail:test --confirm=koru-staging
corepack pnpm build
corepack pnpm staging:prepare
corepack pnpm staging:deploy --confirm=koru-staging
```

`install` yalniz sabit staging Worker/bes DB baglantisini ve kapali runtime
bayraklarini dogrular. Google refresh/tokeninfo ile istemci ve send-only kapsami
yeniden kontrol eder; eski yetki tarihini uzatmaz. Tek JSON `GMAIL_CREDENTIALS`
Worker Secret'i atomik yuklenir. Secret icerigi loga/normal vars'a konmaz.
Staging config `ACCOUNT_MAIL_PROVIDER=gmail` ve yalniz `MAIL_FROM` adresini tasir.
Gmail sirri staging origin'ine baglidir; canlida veya baska origin'de kullanilamaz.
Yetki tarihinden en fazla 7 gun sonra (bir dakika guvenlik payiyla) hazirlik
kontrolu kapanir. Bu uygulama siniri Google'in yetkiyi daha erken iptal etmesini
engellemez.

`test` ayni Gmail adaptorunu Node'da calistirir ve yalniz gondericinin kendi
kutusuna tek deneme postasi yollar. Alici/konu/govde CLI'dan degistirilemez;
hesap linki, parola veya canli veri icermez. Gondermeden once 0600 izinli
`gmail-smoke.json` olusturulur. Cokme/belirsiz cevap dahil ayni deneme otomatik
tekrarlanmaz. Kayit varsa operator incelemesi olmadan silme veya yeniden gonderme.
API kabul sonucuyla Gelen Kutusu/Spam teslimati ayni sey degildir; operator
postayi gordugunu ayrica teyit eder. Bu test Worker HTTP akisini calistirmaz.

Sunucu Gmail adaptorunde MIMEText'in ESM/browser girisi kullanilir; UTF-8 konu,
base64 govde ve satir uzunluklari dogrulanir. `userId=me` yerine gondericinin
e-posta adresiyle istek yapilir; baska Google hesabinin tokeni kullanilamaz.
Refresh istegi ve gonderim yalniz sabit Google HTTPS adreslerine gider;
yonlendirmeler izlenmez. Baslik enjeksiyonu ve ek alicilar reddedilir.
Gmail'in send idempotency anahtari yoktur: belirsiz gonderim/ag/5xx yaniti yeniden
gonderilmez. Yalniz gonderim oncesi gecici refresh hatalari veya kesin 401 icin
sinirli yeniden deneme vardir. Kalici kuyruk, teslimat garantisi veya alarm degildir.
Resend secenegi ve loopback test posta kutusu korunur.

## Henuz tamamlanmayanlar

- Testing durumunda Gmail yetkisinin refresh tokeni 7 gun sonra sona erer.
  Bu kurulum kalici canli posta cozumunu veya Google incelemesini tamamlamaz.
- Gmail adaptorunun/binding'in bulunmasi basli basina gercek kayit ve sifre
  kurtarma kabul testi degildir. Yerel dosyayi normal deploy JSON'una ekleme.
- Varsayilan deployment kapali kalir. Kisitli deneme icin `staging:prepare --onboarding`
  secenegi, dogrulanmis Gmail kurulumu ve bos grup havuzu gerekir; ayrintilar
  [STAGING.md](STAGING.md) icindedir. Gercek kayit/kurtarma posta baglantisi
  alicinin tarayicisinda acilarak ayrica kabul edilir; token sohbete tasinmaz.
- Mevcut yetkinin uygulama kesim tarihi 25 Ekim 2026 02:23 (Europe/Istanbul).
  Google daha erken iptal edebilir. Yenilemede once `staging:prepare` ve deploy
  ile kaydi kapat; eski yetki dosyasinin uzerine yazma veya tarihini uzatma.
- Canli web ve DB'leri bu adimda degistirilmez. Native kabul yapilmamis olur.

## Test

`corepack pnpm test:release:unit` bu aracin dosya izinleri, kapsam/istemci
kontrolu, sahte/paralel donusler, iptal ve yerel HTTP/PKCE testini de icerir.
Testler sentetik kimliklerle calisir; Google hesabina girmez veya posta gondermez.
Gmail UTF-8 MIME, baslik enjeksiyonu, scope/expiry/origin kontrolleri, tekrar
gonderim sinirlari ve Resend/yerel posta uyumlulugu da bu test kapisindadir.
Gercek yerel workerd/Miniflare motorunda Gmail adaptorunun native fetch'i de
sinanir; Google ve e-posta yerine yalniz ag erisimi kapali sentetik yanitlar
kullanilir. Cloudflare `redirect: "error"` desteklemez. Gmail ve Resend
`redirect: "manual"` kullanir; tum 3xx yanitlar reddedilir, gizli anahtarlar
ve posta baska bir adrese yonlendirilmez. Node fetch mock'u tek basina bu
Worker uyumsuzlugunu yakalamaz.

Operator icin gercek Worker posta teshisi:

```bash
node scripts/staging-mail-worker.mjs --confirm=koru-staging
```

Yalniz `koru.coklu` sentetik hesabi ve destek kutusunun +deneme1 adresi
kullanilir. Mevcut parola dogrulanir; kayit ve Turnstile atlanarak yeni hesap
yaratilmaz. Bu, mevcut hesaba e-posta ekleme akisidir. Alici/govde/token,
HTTP cookie'leri veya ham loglar rapora alinmaz. Gecici tail temizlenir.
Git disi `worker-mail-check.json` onceden yazilir; varsayilan tekrar gondermez.
Yalniz logla dogrulanmis mime/refresh hatasinda, yani posta gonderilmeden once,
`--retry-pre-send` ile en fazla iki acik tekrar yapilabilir. Onceki raporlar
korunur; belirsiz send sonucu tekrarlanmaz. Google kabulunu Gelen Kutusu
teyidi yerine sayma. Gercek yeni kullanici kaydi ve kurtarma ayrica kabul edilir.

Kaynaklar: [Google web sunucusu OAuth akisi](https://developers.google.com/identity/protocols/oauth2/web-server),
[Gmail kapsamlar](https://developers.google.com/workspace/gmail/api/auth/scopes),
[Refresh token omru](https://developers.google.com/identity/protocols/oauth2/),
[Resmi Node OAuth kutuphanesi](https://github.com/googleapis/google-auth-library-nodejs).

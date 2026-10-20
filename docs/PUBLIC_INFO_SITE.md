# Koru Kamusal Bilgi Sayfaları

19 Ekim 2026. Operatör yalnız tanıtım, gizlilik ve koşullar sayfaları için
sınırlı Cloudflare dağıtımını onayladı. Bu onay genel kayıt, üretim uygulaması,
veritabanı migration'ı, posta sırrı, ücretli plan veya `main` push'u değildir.

## Yayın Sonucu

19 Ekim'de yalnız ayrı bilgi Worker'ı yayınlandı. Üç sayfa girişsiz ve
yönlendirmesiz HTTPS 200 verdi; API 404, yazma 405 olarak doğrulandı.
Dağıtım kimliği: `357fc8e0-d13a-4a77-b9b1-fc553b246fd0`.
Mevcut uygulamanın dağıtım/ayar özeti önce ve sonra aynı kaldı
(`applicationUnchanged: true`). Üretim uygulamasına veya staging'e dağıtım,
SQL ya da Secret değişikliği yapılmadı. Yeni abonelik/alan adı alınmadı.

Son kaynakta 5 birim ve 22 yerel tarayıcı kontrolü geçti; yeni dosyaların
lint kontrolü uyarısız geçti. Canlı tarayıcı sonucu ayrı
`outputs/koru-public-info/https-report.json` içinden okunur. Google alan
sahipliği, Branding/kapsam doğrulaması ve OAuth üretim durumu henüz tamamlanmadı.

## İzolasyon

- Hedef: `koru-public-info.mustafayapayzeka.workers.dev`.
- Asıl uygulama: `okuma-halkasi.mustafayapayzeka.workers.dev`; dağıtılmaz.
- Yeni Worker yalnız `ASSETS` ve sahiplik işareti `KORU_PUBLIC_INFO_ONLY`
  bağlarını kabul eder. D1, KV, R2, servis, OAuth ve oturum sırları yoktur.
- Yalnız GET/HEAD; hesap/API yolları 404, yazma yöntemleri 405 döner.
- Form, analiz, uygulama çerezi veya yerel depolama yoktur. Cloudflare ağ
  güvenliği kapsamında bağlantı verisi işleyebilir. Statik CSS/JS/fontlar
  yalnız aynı kaynaktan gelir; script/style inline izni ve üçüncü taraf
  bağlantı izni yoktur. HTML yeniden doğrulanır; sabit varlıklar bir saat
  tarayıcı önbelleğine alınabilir. Bu PWA/özel hesap cache'i değildir.
- Yeni Worker mevcut auth/proxy/grup kodunu kullanmaz. Build yalnız sabit
  izin listesindeki marka/font ve sentetik görselleri paketler; repo dizini
  veya uygulamanın `dist/` paketi yayınlanmaz.
- Ürün görüntüleri `public-release-20261019-verified` yerel sentetik
  fixture'larından alınmıştır; gerçek kullanıcı/grup kaydı veya fotoğraf yoktur.

Bu yapı mevcut özel uygulamayı değiştirmeden Google OAuth için kamusal bilgi
sağlar. Google doğrulaması, politika kabulü veya genel yayın izni anlamına
gelmez. Metin kapalı deneme ve mevcut silme/saklama sınırlarını açıklar;
genel hizmet için hukuki değerlendirme hâlâ gereklidir.

## Kaynak ve Kontrol

`public-info/` kaynakları mevcut kurumsal marka, font ve semantic token
sözleşmesini korur. Açık/koyu otomatik cihaz tercihini izler; uygulamanın
dört görünümünden hiçbirini değiştirmez. Yeni çerçeve/bağımlılık kurulmaz.

```bash
nvm use 24
node --test scripts/tests/public-info.test.mjs
corepack pnpm info:test
corepack pnpm info:deploy --confirm=koru-public-info
corepack pnpm info:test:https
```

Test aracı kendi geçici yerel sunucusunu açar ve kapatır. 320/390/1440 px,
açık/koyu, tüm kamusal sayfalar, büyütülmüş gövde metni, JavaScript olmadan
gezinti ve API/yazma engelini doğrular. `outputs/koru-public-info/report.json`
ve ekran görüntüleri Git dışındadır. Başarı gerçek dosyadan okunur.

Dağıtım, son 24 saatte geçmiş aynı varlık+Worker özeti için kabul raporu
ister; hedef yapılandırmasını tekrar doğrular ve dry run yapar. Mevcut
uygulamanın dağıtım kimliği/ayar özeti önce ve sonra karşılaştırılır. SQL
isteği atılmaz. Token bellekte kalır; gizli sağlayıcı yanıtları yazdırılmaz.
Yayın raporu: `.sites-runtime/koru-public-info/deployment.json`.
Mevcut hedefte tanınmayan bağ varsa üzerine yazılmaz.

Bu dar yayın kapısı ana uygulamanın `web:release:check` şartlarını kaldırmaz.
Önceki 21 aşamalı uygulama raporu önceki kaynak özetine aittir. Kamusal site
ekleri sonrası tam uygulama için yeniden sabit sürüm kabulü gerekir; bu
işte değişmeyen uygulama testleri tekrar edilmiş sayılmaz.

## Google'da Devam

Google projesi `koru-mail`. Paylaşılan Audience ekranında **Testing** ve
pasif **Publish app** düğmesi vardı: Branding yapılandırması eksikti.
Kaydetmek tek başına doğrulama değildir.

Dağıtım raporu başarılıysa ve URL'ler girişsiz 200 dönüyorsa Branding alanları:

| Alan | Değer |
| --- | --- |
| Application home page | `https://koru-public-info.mustafayapayzeka.workers.dev/` |
| Privacy policy | `https://koru-public-info.mustafayapayzeka.workers.dev/privacy` |
| Terms of service | `https://koru-public-info.mustafayapayzeka.workers.dev/terms` |
| Authorized domain | `mustafayapayzeka.workers.dev` |

Yetkili alan adına protokol/path yazılmaz; `workers.dev` Cloudflare'a aittir.
Bu üst özel alan seçimi PSL'deki `workers.dev` kaydından türetilmiştir;
Google'ın gerçekten kabul ettiğini operatör ekranı doğrular. Reddedilirse
alan satın almadan önce hata metni incelenir.

Sahiplik doğrulaması için, OAuth projesini yöneten aynı Google hesabıyla
Search Console'da **URL prefix** mülkünü seç:
`https://koru-public-info.mustafayapayzeka.workers.dev/`.
Workers alanı için DNS zone kontrolü varsayma. **HTML tag** yönteminin
`google-site-verification` meta etiketi kamusaldır; OAuth tokenı değildir.
Operatörden bu etiket alındığında yalnız `content` değeri
`.sites-runtime/koru-public-info/google-site-verification.json` içindeki
`{"content":"GOOGLE_TARAFINDAN_VERILEN_DEGER"}` biçimine kaydedilir; build
sayfanın head bölümüne güvenli biçimde ekler. Sonra aynı test/deploy akışı
tekrarlanır ve operatör Search Console'da Verify yapar. Kod veya etiket
uydurulmaz; doğrulandı diye işaretlenmez. Doğrulamadan sonra etiket kaldırılmaz.

Branding/Verification Center sonucu incelenir; gerekirse Google'ın kapsam
doğrulaması tamamlanır. **Publish branding**, **Publish app** ve gerçek
**In production** durumu ayrı adımlardır. Eski Gmail test tokenı yeniden
etiketlenmez veya süresi uzatılmaz; üretim yetkisi sonradan ayrıca alınır.

Kaynaklar:
[Google branding](https://support.google.com/cloud/answer/15549049?hl=en),
[marka doğrulama](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification),
[Search Console doğrulaması](https://support.google.com/webmasters/answer/9008080?hl=en),
[Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat),
[Cloudflare statik varlıklar](https://developers.cloudflare.com/workers/static-assets/).

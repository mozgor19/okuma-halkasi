# birkoru.com Geçiş Hazırlığı

19 Ekim 2026. Ürün adı **Koru**, alan adı `birkoru.com`. Mustafa alan adını
Turkticaret.net'ten satın aldığını bildirdi. Bu belge uygulamanın yayına
hazır olduğu veya alan adının bağlandığı anlamına gelmez.

## Onayın Sınırı

**20 Ekim güncel karar:** Mustafa seçilen C logosunun entegrasyonunu ve ardından
canlıya geçişi istedi. Ücretsiz ayrı Firebase üretim projesinin kimliğini
`koru-951bf` olarak bildirdi. Aşağıdaki DNS-only ve taslak-only sınırlar
19 Ekim geçmişidir; artık logo entegrasyonunu engellemez. Güvenlik/yayın kapısı,
mevcut canlı veriyi koruma ve staging'i taşımama şartı devam eder. Henüz
uygulama dağıtımı/alan bağlantısı veya hesap aktarımı yapılmış değildir.

Onaylanan: Cloudflare Free DNS kurulumu, mevcut kayıtları koruyan geçiş
hazırlığı ve uygulamadan ayrı logo taslakları. Ücretli hizmet açılmaz.

Bu aşamada Worker dağıtımı, Custom Domain/route bağlama, runtime origin,
Secret, SQL, veritabanı bağları, genel kayıt veya main push'u yapılmaz.
Asıl uygulama, staging ve ayrı kamusal bilgi Worker'ı korunur. Logo seçimi
uygulama onayı değildir; kurumsal kimlik geometrisi henüz değiştirilmez.

DNS etkinleştikten sonra Mustafa HTTPS ve Worker adımlarına devam etmek
istedi. Sonraki hedef ayrıca soruldu: önce yalnız mevcut kamusal bilgi
Worker'ını bağlamak veya önce uygulamanın yayın engellerini kapatmak.
Mustafa **önce uygulamanın yayın engellerinin tamamlanmasını** seçti. Geçici
kamusal sayfa bağlantısı yapılmayacak; uygulama/staging/bilgi Worker'ı veya
başka içerik bu alana henüz bağlanmaz. Yerel Firebase prototipi ayrı onaylandı;
bu alan adı, canlı SQL/Secret veya gerçek hesap aktarımı onayı değildir.

## HTTPS ve Worker Ön Kontrolü

19 Ekim salt okunur incelemesi:

- Zone aktif, doğru hesapta, Free Website ve fiyat 0.
- Hesabın Custom Domains envanterinde `birkoru.com` veya `www.birkoru.com`
  için bağlı Worker yoktu.
- `koru-public-info` yalnız `ASSETS` ve `KORU_PUBLIC_INFO_ONLY=true`
  bağlarıyla çalışıyor; hesap/veritabanı/Secret bağı bulunmuyor.
- Mevcut bilgi Workers adresi HTTPS 200, doğru `X-Koru-Site` işareti ve
  çerezsiz yanıt verdi.
- `https://birkoru.com/` bağlantısı sorgu anında `ECONNREFUSED` verdi.
  Bu, sertifikanın varlığı veya yokluğu hakkında tek başına kanıt değildir.
- Sertifika metadata API'si 403 döndürdü. Sertifika çıkmış gibi raporlanmaz;
  ücretli sertifika/Advanced Certificate Manager aboneliği açılmadı.
- Worker/route/DNS/SQL/Secret veya uygulama origin'i değiştirilmedi.

Önce önerilen ara hedef mevcut tanıtım/gizlilik/koşullar Worker'ıydı;
operatör bunun yerine uygulama engellerini kapatmayı seçti. Bu tercih genel uygulama
yayını, kayıt/giriş açılması veya staging verilerinin taşınması değildir.
Custom Domain işlemi sertifika oluşturabilir; mevcut DNS hedefini etkiler.
Öncesinde mevcut hedef ve e-posta kayıtları korunup geri dönüş planı kaydedilir.
İçerik/metadata origin'i ve gerçek HTTPS sayfa/varlık testleri birlikte ele
alınır; sertifika API erişimi olmasa da gerçek tarayıcı kabulü atlanmaz.

## Kontrol Edilen Durum

- Mevcut uygulama: `https://okuma-halkasi.mustafayapayzeka.workers.dev`.
- Staging: `https://koru-staging.mustafayapayzeka.workers.dev`.
- Kamusal bilgi: `https://koru-public-info.mustafayapayzeka.workers.dev`.
- Cloudflare hesabı mevcut proje hesabıyla eşleşiyor; giriş doğrulandı.
- İlk DNS hazırlık akışı sağlayıcı HTTP 403 ile durdu; o anda alana ait zone
  yoktu. Operatör daha sonra panelden ekledi. Son salt okunur API kontrolünde
  doğru hesapta tek `birkoru.com` zone'u, **Free Website**, fiyat **0** ve
  önce **pending** durumu doğrulandı. Operatör NS değişikliğini tamamladıktan
  sonraki 19 Ekim salt okunur kontrolde API durumu **active** oldu.
- Atanan gerçek Cloudflare NS: `cortney.ns.cloudflare.com` ve
  `damien.ns.cloudflare.com`. Operatörün ekranıyla API sonucu eşleşti.
- Herkese açık DNS-over-HTTPS sorgusu Türkticaret ad sunucularını döndürdü:
  `ns1.turkticaret.net`, `ns2.turkticaret.net`, `ns3.turkticaret.net`.
- Alan kökünde MX ve TXT kayıtları var. Sağlayıcı varsayılanı olduğu
  varsayılıp silinmez; DNS Pro envanteriyle karşılaştırılarak korunur.
- Sorgu anında DS yanıtı yoktu. Bu sonuç ilerideki geçiş için DNSSEC'i
  kontrol etme yükümlülüğünü kaldırmaz. Eksiksiz DNS envanteri değildir.
- DNS kayıtlarını listeleyen API çağrısı da 403 döndürdü. Bunun yerine
  **herkese açık** yetkili DNS sorgularıyla sekiz bilinen kayıt eski
  `ns1.turkticaret.net` ve iki yeni Cloudflare NS üzerinde karşılaştırıldı.
  A, dört CNAME (`autoconfig`, `autodiscover`, `mail`, `www`), MX, TXT ve
  `_autodiscover._tcp` SRV değerlerinin tamamı üç sunucuda eşleşti.
  Bu kontrol bilinmeyen alt alan/DKIM kayıtlarının tam envanteri değildir.
- Kayıt tarama ekranındaki beş A/CNAME için DNS only kullanılması anlatıldı;
  mevcut hedef değerler korunur. Bilinen kayıtların DNS yanıtları eşleşti.
- **DNS aktivasyonu doğrulandı:** `.com` kayıt sisteminin RDAP nameserver
  alanları ve herkese açık özyinelemeli DNS sorgusu iki Cloudflare adresini
  döndürdü; Cloudflare API **active**, **Free Website**, fiyat **0** ve doğru
  hesap bilgisini doğruladı. Operatörün önceki pending ekranı güncel sonucu
  yansıtmıyordu. Kayıt sahibinin kişisel bilgileri saklanmadı veya yazdırılmadı.
- Worker/Custom Domain bağlantısı, HTTPS sertifikası ve uygulama yayını bu
  kontrolde yapılmadı veya onaylanmadı. Sonraki aşama için ayrı onay gerekir.

Oturum tokenı, kullanıcı kaydı veya özel bağlantı bu belgeye yazılmaz.

## Şimdi Operatörün Yapacağı Adım

1. Cloudflare'da uygulamanın bulunduğu **hesabı** seç. Worker seçilmez;
   staging veya verisi olan uygulamanın Settings/Bindings ekranına girilmez.
2. Hesap ana ekranında **Domains / Websites > Onboard a domain / Add a site**.
3. `birkoru.com` yaz; **Free** seç. Ücretli yükseltme veya transfer yapma.
4. DNS tarama sonuçlarını kontrol et. MX, TXT ve varsa mail doğrulama/DKIM,
   alt alan kayıtlarını Türkticaret DNS Pro envanteriyle karşılaştır.
   Otomatik tarama eksiksiz envanter garantisi değildir. Kayıt silme.
5. Cloudflare'ın atadığı iki gerçek `...ns.cloudflare.com` adresini paylaş.
   Nameserver adresleri kamusaldır; parola/API anahtarı paylaşılmaz.
6. **Kayıtların korunması doğrulanmadan Türkticaret nameserver'larını değiştirme.**
   DNS aktivasyonu uygulamayı Worker'a bağlama işlemiyle karıştırılmaz.

CLI girişinin başarılı olması Zone Edit izni vermez. Ek/global API anahtarı
istemek yerine alanın panelden eklenmesi tercih edilir; 403 aşılmaya çalışılmaz.

## Kayıt Kontrolünden Sonra DNS Aktivasyonu

Onaylı DNS aşaması içinde, doğru zone ve kayıtlar doğrulandıktan sonra:

1. Türkticaret: **Domain İşlemleri > Domain Yönetimi > birkoru.com > Yönet >
   DNS Güncelleme > Kendi Nameserver bilgilerimi kullanmak istiyorum**.
2. Yalnız Cloudflare'ın bu alan için atadığı iki nameserver kullanılır.
   E-posta doğrulama kodunu operatör kendi ekranına girer; kod istenmez.
3. Aktif DS/DNSSEC varsa sağlayıcı yönergesine göre geçiş öncesi ele alınır.
   Eski DS ile yeni nameserver birleştirilmez. Yeni DNSSEC, zone aktif ve
   zincir doğrulaması hazır olduktan sonra ayrı kontrol edilir.
4. Cloudflare zone **Active**, yetkili NS ve MX/TXT korunumu doğrulanır.
   Yayılma için sabit süre sözü verilmez. DNS aktivasyonu HTTPS veya uygulama
   yayını kabulü değildir. Sertifika ve Worker hedefi daha sonra doğrulanır.

DNS-only onayı, boş/yanlış zone'a NS geçişini veya mevcut kayıtların
silinmesini kapsamaz. NS geçişi web ve e-posta çözümlemesini etkileyebilir.

## Sonraki Aşamalar İçin Ayrı Onay

| Aşama | Hazırlık / Kabul |
| --- | --- |
| Logo | C: sade sayfa/yaprak yönü geliştirme için seçildi; SVG, gerçek font ve küçük boyut önizlemesi sonrasında uygulama onayı alınacak |
| Kamusal sayfalar | Ana uygulama hazır olmadan alanı staging/legacy login ekranına bağlama; geçici bilgi sayfası hedefi gerekiyorsa ayrıca onay al |
| Google | Search Console Domain mülkü için gerçek TXT değeri, Branding/authorized domain ve politikalar birlikte incelenir; OAuth hâlâ Testing, üretim sayılmaz |
| Uygulama origin'i | Hedef `https://birkoru.com`; `AUTH_PUBLIC_ORIGIN`, gizlilik/koşullar, canonical/OG ve Turnstile hostname birlikte değişmeli |
| Posta | `scripts/gmail-oauth.mjs` içindeki üretim origin'i yeni yetki almadan önce gözden geçirilmeli; eski token yeniden etiketlenmez veya test süresi uzatılmaz |
| Yayın araçları | `scripts/web-production-policy.mjs`, ilgili testler ve kanıt origin'i aynı karara taşınmalı; yalnız DNS için mevcut kontroller gevşetilmez |
| www | HTTPS ve ana adrese yönlendirme, path/query korunumu ve döngü testi; doğrulama/reset/davet parametreleri log veya genel metadata'ya yazılmaz |
| Veri | Aynı canlı canonical/grup D1'leri korunmalı; staging test hesapları canlıya kopyalanmamalı; migration ve yedek/restore ayrı onaylı olmalı |
| Oturum/PWA | Yeni origin ayrı çerez/cache/kurulum kimliğidir. Yeniden giriş/ana ekrana yeniden ekleme gerekebilir; hesap verisi kaybıyla karıştırılmaz |
| Eski bağlantılar | Reset/doğrulama/davet ve eski PWA akışları için yol bazlı karar; tüm yöntemleri/tokenları körlemesine yönlendirme yok |
| Yayın | WEB_RELEASE kapısı, sabit kaynak test/audit, gerçek cihaz ve ayrı dağıtım onayı; DNS başarısı bu engelleri kapatmaz |

Şu anda kodda aktif origin veya logo değişikliği yapılmadı. Genel yayın
engelleri [WEB_RELEASE.md](WEB_RELEASE.md) ve
[WEB_PUBLIC_LAUNCH.md](WEB_PUBLIC_LAUNCH.md) içinde açık kalır.

## Kaynaklar

- [Cloudflare alan ekleme](https://developers.cloudflare.com/fundamentals/manage-domains/add-site/)
- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Türkticaret DNS güncelleme](https://support-center.turkticaret.net/dns-guncelleme-nasil-yapilir/)

Kaynaklar 19 Ekim'de kontrol edildi; panel etiketleri değişebilir. NS çifti,
Free plan ve DNS etkinleşmesi doğrulandı; sertifika ve uygulama dağıtımı
henüz doğrulanmış veya yapılmış değildir.

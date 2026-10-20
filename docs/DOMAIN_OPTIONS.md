# Koru Alan Adı Seçenekleri

İlk araştırma: 18 Ekim 2026, 22:48 Türkiye saati; o tarihte satın alma yapılmamıştı.
Fiyatlar USD, standart/non-premium adlar içindir; vergi, banka kuru ve
premium/satış sonrası bedelleri dahil değildir. TL karşılığı ödeme gününün
kart kuru ve vergileriyle hesaplanır; sabit TL fiyat sözü verilmez.

## Güncel Karar: birkoru.com

19 Ekim'de Mustafa `birkoru.com` alan adını Turkticaret.net üzerinden satın
aldığını bildirdi. Ürün adı **Koru** olarak kalır. Aşağıdaki seçenekler ve
Cloudflare fiyatları geçmiş araştırmadır; satın alınan alanın faturası veya
Turkticaret yenileme bedeli değildir. Yeni satın alma yapılmayacak.

Yalnız Cloudflare Free DNS kurulumu ve geçiş hazırlığı onaylandı; uygulama
dağıtımı, veritabanı değişikliği ve ücretli hizmet onayı yoktur.
[Alan adı geçiş planı ve mevcut durum](DOMAIN_TRANSITION.md).

## 19 Ekim Satın Alma Öncesi Yeniden Kontrol

Mustafa alan adını yeniden değerlendirmek istedi; henüz ad seçmedi ve
satın alma/ücretli hizmet onayı vermedi. Ücretsiz Workers uygulama ve
kamusal bilgi adresleri değişmedi. Yalnız araştırma yapıldı.

Cloudflare'ın 19 Ekim canlı standart fiyatları:

| Aday | İlk Yıl | Yıllık Yenileme | Değerlendirme |
| --- | ---: | ---: | --- |
| koruoku.com | $10.46 | $10.46 | Kısa, telefonda yazımı kolay; güncel ilk öneri |
| koruokuma.com | $10.46 | $10.46 | Okuma amacını daha doğrudan anlatır |
| koru.link | $7.20* | $7.20* | Marka adı yalın; kısa ad/premium kontrolü özellikle gerekli |
| koruoku.app | $8.20 kampanya | $14.20 | Uygulama kimliğine uygun; yenilemesi .com'dan yüksek |
| korukulup.com | $10.46 | $10.46 | Grup fikrini vurgulayan alternatif |

Bu beş aday için IANA bootstrap dizinindeki yetkili RDAP servisleri 404
döndürdü. **Kayıt bulunmaması satın alınabilirlik veya standart fiyat
garantisi değildir.** Ayrılmış/premium adlar ve nihai toplam ancak arama ve
ödeme ekranında doğrulanır; yıldızlı fiyat alan adına özel teklif değildir.
Vergi/kart kuru hariç, kampanyalar ve sonraki yılların fiyatları değişebilir.
[Cloudflare fiyat listesi](https://pricing.registrar.cloudflare.com/).

Aynı kontrolde `koru.app`, `koru.page`, `koru.club` ve `koru.ink` RDAP 200
ile kayıtlı çıktı. Ek adaylar `okukoru.com`, `korubook.com`, `korubooks.com`,
`koruokuma.app`, `koruokuma.club` için kayıt bulunmadı; bunlara da aynı
müsaitlik/premium sınırlaması uygulanır. Kişisel kayıt sahibi bilgisi
okunmadı veya saklanmadı.

Domain satın almak mevcut uygulamayı otomatik genel yayına açmaz. Seçimden
sonra önce kamusal bilgi Worker'ının özel alanı ve Google Branding/Search
Console adresleri planlanır; asıl hesap/PWA origin geçişi, çerezler,
Turnstile ve posta bağlantıları ayrıca kontrollü ele alınır. Genel kayıt,
DB migration'ı ve üretim uygulaması dağıtımı için önceki engeller geçerlidir.

Google'ın son operatör görüntüsü: Verification status, uygulama Testing
durumunda olduğu için doğrulamanın şu an gerekli olmadığını söylüyor;
yayın durumu Audience'dan değiştirilir. **In production doğrulanmadı.**
[Google Audience açıklaması](https://support.google.com/cloud/answer/15549945?hl=en).

## Önceki Araştırma

İlk tercihim **koruokuma.com**: telefonda yazması ve okuma ürünü olduğunu
anlaması kolay, yenilemesi makul. **koruoku.com** daha kısa bir alternatiftir.
Ürün adı yine Koru kalır; alan adı kelime markasını değiştirmez.

| Aday | İlk Yıl | Yıllık Yenileme | 3 Yıl Toplamı* | Kayıt Kontrolü |
| --- | ---: | ---: | ---: | --- |
| koru.link | $7.20 | $7.20 | $21.60 | RDAP kayıt bulamadı; dört harfli ad için premium bedeli özellikle kontrol edilmeli |
| koruokuma.com | $10.46 | $10.46 | $31.38 | RDAP kayıt bulamadı |
| koruoku.com | $10.46 | $10.46 | $31.38 | RDAP kayıt bulamadı |
| korukulup.com | $10.46 | $10.46 | $31.38 | RDAP kayıt bulamadı |
| koruokuma.app | $8.20 kampanya | $14.20 | $36.60 | RDAP kayıt bulamadı |

*Bugünkü fiyat hiç değişmezse hesaplanan karşılaştırmadır; çok yıllı teklif
veya gelecek fiyat garantisi değildir. Kampanya sona erebilir.
[Cloudflare Registrar canlı fiyat tablosu](https://pricing.registrar.cloudflare.com/).

Kısa, noktalı yazımı seviyorsan **koru.link** en ekonomik adaydır. Standart
ücretle gerçekten satın alınabiliyorsa değerlendirilebilir; `.com` seçeneği
ise ürünün okuma amacını daha doğrudan anlatır. Ek kontrolde `koruoku.app`,
`koruokuma.page`, `koruokuma.club` için de RDAP kayıt bulamadı; `koru.ink` kayıtlıydı.

RDAP kontrolü resmi IANA bootstrap dizinindeki yetkili kayıt servislerine
yapılan GET istekleriyle yapıldı. 404 sonucu bir kayıt bulunmadığı anlamına
gelir; ayrılmış/premium/tescili kısıtlı adları veya ödeme anındaki müsaitliği
garanti etmez. Son karar Cloudflare alan adı arama ve ödeme ekranında doğrulanır.
[IANA RDAP bootstrap](https://data.iana.org/rdap/dns.json).

`koru.page`, `koru.club`, `koruapp.com` kayıtlı çıktı; sırf kısa diye pahalı
ikinci el satın almayı önermiyorum. Standart `.page` $10.20/yıl, `.club`
$15.20/yıl; ancak bu tutarlar kayıtlı `koru.page`/`koru.club` satış fiyatı değildir.

`koru.book` estetik bir fikir; `.book` gerçek bir üst alan adıdır ve Amazon
Registry tarafından yönetilir. İncelenen Cloudflare fiyat listesinde ve
Amazon'un güncel ürün kataloğunda normal satın alma teklifi doğrulanmadı.
Bu nedenle onu alınabilir/ucuz adaymış gibi önermiyorum. `.books` başka bir
uzantıdır; karıştırılmamalı.
[IANA .book kaydı](https://www.iana.org/domains/root/db/book.html),
[Amazon Registry](https://www.registry.amazon/).

Ucuz görünen `.site`/`.online` kampanyaları $4.99'dan başlayıp $27.70/yıl
yenileniyor; düşük bütçeli bu ürün için `.com` daha dengeli.
Alan adı sahipliği marka kullanım hakkı veya tescil uygunluğu garantisi değildir.

## Cloudflare Adımları

1. Cloudflare hesabında iki faktörlü doğrulamayı aç, kurtarma kodlarını özel sakla.
2. **Domain Registration / Register Domains** içinde seçtiğin tam adı ara.
3. Premium olmadığını, ilk yıl, yenileme, vergi ve toplam tutarı birlikte kontrol et.
4. Yalnız onayladığın adı kendi hesabında al; WHOIS kayıt bilgilerini doğru gir,
   kayıt e-postası doğrulamasını tamamla. Otomatik yenileme/kart süresini kontrol et.
5. Alan adı Cloudflare zone olarak etkinleşince **Workers & Pages → ilgili
   production Worker → Settings → Domains & Routes → Add → Custom Domain**.
   Alan adının tamamını yaz. Mevcut DNS kayıtlarını incelemeden silme.
6. Cloudflare DNS kaydı ve sertifika oluşturmasını bekle; HTTPS adresini kontrol et.
   SSL sertifikası veya web barındırma paketi ayrıca satın alma.
7. Staging ayrı Worker ve ayrı D1 olarak kalır; yeni alan adı onu production
   DB'sine bağlamak için kullanılmaz. `staging.ALAN_ADI` sonradan ayrı eklenebilir.
8. Dağıtım öncesi `AUTH_PUBLIC_ORIGIN`, gizlilik/koşul URL'leri, Turnstile
   hostname ve e-posta linklerini aynı canlı HTTPS origin'e göre yapılandır.
9. Eski workers.dev adresindeki kullanıcı ve eski davet/reset linkleri için
   kontrollü geçiş kararı ver. Farklı origin'in oturum çerezleri taşınmaz.
10. Yayın engelleri kapanıp `WEB_RELEASE.md` kabulü geçmeden genel kaydı açma.

Cloudflare Custom Domain yönergesi DNS/sertifika bağlamasını açıklar:
[Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
Alan adı ücreti Workers/D1/posta limitlerini kaldırmaz. Ücretsiz kotalar,
kapasite ve olası ücretler kullanım planında ayrıca izlenmelidir.

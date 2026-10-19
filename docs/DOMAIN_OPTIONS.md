# Koru Alan Adı Seçenekleri

Araştırma: 18 Ekim 2026, 22:48 Türkiye saati. Satın alma yapılmadı.
Fiyatlar USD, standart/non-premium adlar içindir; vergi, banka kuru ve
premium/satış sonrası bedelleri dahil değildir. TL karşılığı ödeme gününün
kart kuru ve vergileriyle hesaplanır; sabit TL fiyat sözü verilmez.

## Öneri

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

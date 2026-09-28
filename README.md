# Okuma Halkası

Altı kişilik haftalık okuma grubu için Türkçe, tam yığın bir web uygulaması.

## Özellikler

- Haftanın kitabı, buluşma arşivi ve gelecek kitaplar yol haritası
- Kitap bilgileriyle buluşma veya plan ekleme
- Open Library üzerinden isteğe bağlı kitap arama
- Tarih, saat, konum, harita bağlantısı ve buluşma notu
- Katılım, okuma durumu, 1-10 puan ve yorum
- Buluşma fotoğrafları ve kitap kapakları
- D1 veritabanında kalıcı kayıt ve görsel saklama
- Ayrı üye hesapları ve sunucu tarafında yönetici yetkisi kontrolü

## Yetkilendirme

Her üye kendi kullanıcı adı ve şifresiyle giriş yapar. Oturum çerezi üye kimliğini imzalı olarak taşır; işlem ve yükleme API'leri istemciden üye numarası kabul etmez. Yönetici yetkisi, oturumdaki üyeye ait `members.role` alanından sunucuda kontrol edilir.

Cloudflare Worker oluşturulduktan sonra `Settings > Variables and Secrets` bölümüne iki adet **Secret** ekleyin:

- `MEMBER_CREDENTIALS`: kullanıcı adı, üye numarası ve parola eşlemelerini içeren tek satırlık JSON
- `SESSION_SECRET`: en az 32 karakterlik rastgele imza anahtarı

Örnek `MEMBER_CREDENTIALS` biçimi:

```json
{"mustafa":{"memberId":1,"password":"benzersiz-guclu-sifre"},"ayse":{"memberId":2,"password":"baska-guclu-sifre"}}
```

Kullanıcı adları küçük harf, rakam, nokta, alt çizgi veya kısa çizgi içerebilir. `memberId` değerleri D1 içindeki `members.id` değerleriyle aynı olmalıdır. Parolaları kaynak koda, GitHub'a veya normal metin değişkenine eklemeyin.

Bir üyeyi yönetici yapmak için veritabanındaki rolü değiştirin; `MEMBER_CREDENTIALS` içinde yönetici bilgisi bulunmaz:

```sql
UPDATE members SET role = 'admin' WHERE id = 1;
```

Parola listesini değiştirmek yeni girişleri etkiler. Mevcut bütün oturumları hemen kapatmak için `SESSION_SECRET` değerini de değiştirin.

## Yerel geliştirme

Node.js 22.13+ ve pnpm gerekir. Bağımlılıkları yükleyip `pnpm dev` ile çalıştırın. D1 bağlantısını tanımlayın, `drizzle/0000_strange_eternals.sql` ve `drizzle/0001_store_media_in_d1.sql` göçlerini uygulayın. İstenirse yalnızca yerelde `demo/seed-local.sql` örnek verisi kullanılabilir.

Derleme:

```bash
pnpm build
```

Bu uygulama sunucu işlevleri ve kalıcı D1 veritabanı kullandığından statik GitHub Pages üzerinde çalışmaz.

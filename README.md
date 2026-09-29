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
- Ayrı üye hesapları, parola değiştirme ve sunucu tarafında yönetici yetkisi kontrolü

## Yetkilendirme

Her üye kendi kullanıcı adı ve şifresiyle giriş yapar. Oturum çerezi üye kimliğini ve hesap sürümünü imzalı olarak taşır; işlem ve yükleme API'leri istemciden üye numarası kabul etmez. Yönetici yetkisi, oturumdaki üyeye ait `members.role` alanından sunucuda kontrol edilir.

Parolalar `member_accounts` tablosunda düz metin olarak tutulmaz. Her parola ayrı rastgele salt ile PBKDF2-SHA-256 kullanılarak türetilmiş hash biçiminde saklanır. Beş hatalı girişten sonra hesap 15 dakika kilitlenir. Kullanıcı parolasını değiştirdiğinde önceki oturum sürümleri geçersiz olur.

Cloudflare Worker içinde `Settings > Variables and Secrets` bölümüne şu Secret'ları ekleyin:

- `SESSION_SECRET`: en az 32 karakterlik rastgele oturum imza anahtarı
- `MEMBER_CREDENTIALS`: ilk D1 hesap geçişi için kullanıcı adı, üye numarası ve başlangıç parolaları

Örnek `MEMBER_CREDENTIALS` biçimi:

```json
{"mustafa":{"memberId":1,"password":"benzersiz-guclu-sifre"},"ayse":{"memberId":2,"password":"baska-guclu-sifre"}}
```

`drizzle/0002_member_accounts.sql` üretim D1 veritabanına uygulandıktan sonra her kullanıcının ilk başarılı girişi hesabı otomatik olarak D1'e taşır. Bütün üyeler en az bir kez giriş yaptıktan sonra `MEMBER_CREDENTIALS` Secret'ı kaldırılabilir. `SESSION_SECRET` kalmalıdır.

Kullanıcı adları küçük harf, rakam, nokta, alt çizgi veya kısa çizgi içerebilir. `memberId` değerleri D1 içindeki `members.id` değerleriyle aynı olmalıdır. Parolaları kaynak koda, GitHub'a veya normal metin değişkenine eklemeyin.

Bir üyeyi yönetici yapmak için veritabanındaki rolü değiştirin:

```sql
UPDATE members SET role = 'admin' WHERE id = 1;
```

## Migration sırası

Yeni bir veritabanında SQL dosyalarını sırayla uygulayın:

1. `drizzle/0000_strange_eternals.sql`
2. `drizzle/0001_store_media_in_d1.sql`
3. `drizzle/0002_member_accounts.sql`

Mevcut üretim veritabanında yalnızca henüz uygulanmamış olan `0002_member_accounts.sql` dosyasını çalıştırın. Migration uygulanmadan mevcut Secret hesaplarıyla giriş devam eder; parola değiştirme işlemi migration tamamlanana kadar açılmaz.

## Yerel geliştirme

Node.js 22.13+ ve pnpm gerekir. Bağımlılıkları yükleyip `pnpm dev` ile çalıştırın. D1 bağlantısını ve gerekli Secret'ları tanımlayın. İstenirse yalnızca yerelde `demo/seed-local.sql` örnek verisi kullanılabilir.

Derleme:

```bash
pnpm build
```

Bu uygulama sunucu işlevleri ve kalıcı D1 veritabanı kullandığından statik GitHub Pages üzerinde çalışmaz.

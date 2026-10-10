# Okuma Halkası

Altı kişilik haftalık okuma grubu için Türkçe, tam yığın bir web uygulaması.

## Mobil dönüşüm

iOS ve Android çalışmasına yeni bir oturumda başlarken önce
[mobil devir belgesini](docs/MOBILE_HANDOFF.md) ve
[özellik/kabul listesini](docs/MOBILE_ACCEPTANCE.md) okuyun. Bu belgeler mevcut
özellikleri, API'leri, tasarım referanslarını ve doğrulanması gereken mobil işleri
kaydeder; henüz geliştirilmiş bir native uygulama yoktur.

## Özellikler

- Tarihe göre bu hafta, sıradaki veya son buluşmayı gösteren ana ekran
- Buluşma arşivi, oylamalı gelecek kitaplar yol haritası ve geri alınabilir çöp kutusu
- Profil fotoğrafı, kişisel buluşma galerisi, favori kitaplar ve okuma özeti
- Kitap bilgileriyle buluşma veya plan ekleme ve sonradan künye düzenleme
- Aynı kitap kaydıyla bölüm bilgili devam buluşmaları oluşturma
- Open Library üzerinden isteğe bağlı kitap arama
- Tarih, saat, konum, harita bağlantısı ve buluşma notu
- Katılım, okuma durumu, kaldığı sayfa, 1-10 puan ve yorum
- Genel kayıt araması, buluşma bildirimleri, takvim dosyası ve ZIP albüm indirme
- Yalnızca ilgili buluşmaya bağlı misafir katılımcılar
- Buluşma fotoğrafları ve kitap kapakları
- D1 veritabanında kalıcı kayıt ve görsel saklama
- Ayrı üye hesapları, parola değiştirme ve sunucu tarafında yönetici yetkisi kontrolü
- Tarayıcı içinde çalışan, yönetici onaylı fotoğraftan katılımcı önerileri

## Yetkilendirme

Her üye kendi kullanıcı adı ve şifresiyle giriş yapar. Oturum çerezi üye kimliğini ve hesap sürümünü imzalı olarak taşır; işlem ve yükleme API'leri istemciden üye numarası kabul etmez. Yönetici yetkisi, oturumdaki üyeye ait `members.role` alanından sunucuda kontrol edilir.

Parolalar `member_accounts` tablosunda düz metin olarak tutulmaz. Her parola ayrı rastgele salt ile PBKDF2-SHA-256 kullanılarak türetilmiş hash biçiminde saklanır. Beş hatalı girişten sonra hesap 15 dakika kilitlenir. Kullanıcı parolasını değiştirdiğinde önceki oturum sürümleri geçersiz olur.

Cloudflare çalışma ortamındaki PBKDF2 sınırı nedeniyle yeni hashler 100.000 iterasyonla üretilir. Eski 210.000 iterasyonlu kayıtlar, ilgili kullanıcı `MEMBER_CREDENTIALS` Secret'ındaki mevcut parolasıyla ilk kez giriş yaptığında otomatik olarak yeniden hashlenir.

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
4. `drizzle/0003_member_profiles_and_reading_progress.sql`
5. `drizzle/0004_face_recognition.sql`
6. `drizzle/0005_club_tools.sql`
7. `drizzle/0006_super_admin_roles.sql`
8. `drizzle/0007_meeting_rsvps.sql`

Mevcut üretim veritabanında migration dosyalarını numara sırasıyla ve yalnızca birer kez çalıştırın. Hesap migration'ı uygulanmadıysa önce `0002_member_accounts.sql`, ardından profil, favori ve devam eden okuma alanları için `0003_member_profiles_and_reading_progress.sql` çalıştırılmalıdır. Yüz referansları ve katılımcı önerileri için `0004_face_recognition.sql`; kitap oylaması, okuma sayfası, misafirler ve çöp kutusu için `0005_club_tools.sql`; ana yönetici rolleri için `0006_super_admin_roles.sql`; buluşma paylaşımı ve "Geliyorum" kayıtları için son olarak `0007_meeting_rsvps.sql` uygulanmalıdır.

## Yüz eşleştirme gizliliği

Yüz algılama ve eşleştirme modeli tarayıcıda çalışır. Model dosyaları uygulamanın kendi `/face-models/` yolundan yüklenir; buluşma fotoğrafları, referans fotoğrafları ve yüz vektörleri harici bir yapay zeka servisine gönderilmez. Yüz vektörleri kalıcı olarak saklanmaz.

Referans fotoğrafları oturum korumalı `media` tablosunda tutulur. Her üye kendi referansını kaldırabilir; yönetici de açık rıza verilen üyeler için referans ekleyip kaldırabilir. Sistem yalnız öneri üretir ve katılım kaydı yönetici seçimleri onayladıktan sonra oluşturulur.

Yerel `humans/` klasörü Git tarafından yok sayılır. Yönetici profildeki **Yüz verisi > Toplu aktar** kontrolüyle dosyaları seçtiğinde, dosya adı üye adıyla eşleştirilir. Örneğin `mustafa_ozgor.png`, `Mustafa Özgör` üyesine bağlanır.

## Yerel geliştirme

Node.js 22.13+ ve pnpm gerekir. Bağımlılıkları yükleyip `pnpm dev` ile çalıştırın. D1 bağlantısını ve gerekli Secret'ları tanımlayın. İstenirse yalnızca yerelde `demo/seed-local.sql` örnek verisi kullanılabilir.

Derleme:

```bash
pnpm build
```

Bu uygulama sunucu işlevleri ve kalıcı D1 veritabanı kullandığından statik GitHub Pages üzerinde çalışmaz.

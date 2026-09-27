# Okuma Halkası — tasarım ve işlev önizlemesi

Altı kişilik haftalık okuma grubu için hazırlanmış, Türkçe bir tam yığın site prototipi. Bu sürüm yerel önizleme içindir; henüz herkese açık olarak barındırılmamıştır.

## Bu sürümde çalışan akışlar

- Haftanın kitabı, buluşma arşivi ve yöneticinin düzenlediği gelecek kitaplar yol haritası
- Kitap adı, yazar, yayınevi, sayfa sayısı, ISBN ve kapak görseliyle buluşma veya plan ekleme
- Open Library üzerinden isteğe bağlı kitap arama ve künye önerisi; erişim kesilirse elle giriş
- Tarih, saat, konum, harita bağlantısı ve buluşma notu
- Üyenin kendini katılımcı olarak eklemesi, okudum/kısmen okudum/okumadım seçimi, zorunlu 1–10 puan ve isteğe bağlı yorum
- Yöneticinin elle katılımcı eklemesi, planı buluşmaya dönüştürmesi ve buluşma yerini düzenlemesi
- Üyelerin fotoğraf yükleyip ilgili kitap sayfasında görmesi; yüklenen fotoğraf tarayıcıda boyutlandırılır
- Telefon ve masaüstü için uyarlanabilir arayüz; kapak görselleri ve kitap kartları

## Önemli: gerçek hesaplara henüz hazır değil

Üstteki üye seçici **demo kimlik değiştiricisidir**. İstekler istemcinin gönderdiği üye numarasını kullanır; kişi ve yönetici yetkileri güvenli biçimde doğrulanmaz. Bu sürümü gerçek grubun verileriyle internete açmayın. Yayına geçmeden önce gerçek oturum açma, sunucuda üyelik ve yönetici yetkisi doğrulama, kalıcı veritabanı/görsel depolama ve yedekleme gereklidir. Örnek üyeler, kitaplar, yorumlar ve buluşma kayıtları kurgusaldır.

GitHub kaynak kodunu saklamak ve sürümlemek için uygundur. Bu uygulama veritabanı ve fotoğraf yükleme kullandığından yalnızca statik GitHub Pages ile çalışmaz; yayında sunucu işlevleri, kalıcı veritabanı ve nesne depolama gerekir.

## Yerel çalıştırma

Node.js 22.13+ ve pnpm gerekir. Bu proje Sites/Vinext başlangıç çatısını kullanır. Bağımlılıkları yükleyip `pnpm dev` ile önizleyin. Veritabanı bağının yerel ortama tanımlanması, `drizzle/0000_strange_eternals.sql` şema göçünün uygulanması ve istenirse `demo/seed-local.sql` örnek verinin yüklenmesi gerekir. Sites ortamında derleme için `pnpm build` kullanılabilir. Örnek veriyi üretim veritabanına uygulamayın.

Ekran görüntüleri, kaynak paketin yanında ayrı dosyalar olarak teslim edilmiştir.

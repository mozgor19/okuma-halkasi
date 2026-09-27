-- Sample members and meetings for the local design preview only. Do not apply in production.
INSERT INTO members (id, name, role, color) VALUES
(1, 'Mustafa', 'admin', '#bd8464'),
(2, 'Deniz', 'member', '#769e9a'),
(3, 'Ece', 'member', '#9881a5'),
(4, 'Mert', 'member', '#a08b65'),
(5, 'İrem', 'member', '#b37f85'),
(6, 'Can', 'member', '#6d8eaa');
INSERT INTO books (id, title, author) VALUES
(1, 'Yorgunluk Toplumu', 'Byung-Chul Han'),
(2, 'Siddhartha', 'Hermann Hesse'),
(3, 'Kim Var İmiş Biz Burada Yoğ İken', 'Cemal Kafadar');
INSERT INTO meetings (id, book_id, date, location, note, created_by) VALUES
(1, 1, '2026-10-03T15:00', 'Buluşma yeri eklenecek', 'Bu hafta başarı baskısını ve dinlenme fikrini konuşacağız.', 1);
INSERT INTO attendance (meeting_id, member_id, reading_status) VALUES
(1, 2, 'read'), (1, 3, 'partial'), (1, 4, 'read');
INSERT INTO reviews (meeting_id, member_id, rating, comment) VALUES
(1, 2, 9, 'Kısacık ama uzun süre düşündürüyor.'),
(1, 3, 8, 'Bazı bölümlere katılmasam da sohbet açmaya çok uygun.');
INSERT INTO roadmap (id, book_id, planned_date, note, created_by) VALUES
(1, 2, '2026-10-10', 'Bir sonraki durak', 1),
(2, 3, '2026-10-17', 'Tarih haftası', 1);

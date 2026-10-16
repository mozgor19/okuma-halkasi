-- Synthetic fixtures. Only scripts/groups-development.mjs uses this file locally.
INSERT INTO members (id,name,role,color) VALUES
  (1,'Demo Çoklu','super_admin','#476963'),
  (2,'Demo Tek Grup','member','#745991'),
  (3,'Demo Üyeliksiz','member','#496282');
INSERT INTO books (id,title,author,pages) VALUES (1,'Birinci Grup Kitabı','Örnek Yazar',240);
INSERT INTO meetings (id,book_id,date,location,note,created_by)
  VALUES (1,1,'2099-01-01T15:00','Birinci grup buluşma yeri','Geliştirme kaydı',1);
INSERT INTO roadmap (id,book_id,planned_date,note,created_by)
  VALUES (1,1,'2099-02-01','Birinci grup planı',1);

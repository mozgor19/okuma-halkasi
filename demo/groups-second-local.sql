-- Deliberately reuse record IDs to test group isolation and role boundaries.
UPDATE members SET role = 'member' WHERE id = 1;
UPDATE members SET role = 'super_admin' WHERE id = 2;
UPDATE books SET title = 'İkinci Grup Kitabı' WHERE id = 1;
UPDATE meetings SET location = 'İkinci grup buluşma yeri' WHERE id = 1;
UPDATE roadmap SET note = 'İkinci grup planı' WHERE id = 1;

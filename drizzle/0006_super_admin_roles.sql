UPDATE members
SET role = 'super_admin'
WHERE id = (
  SELECT id
  FROM members
  WHERE role = 'admin' AND is_guest = 0
  ORDER BY id
  LIMIT 1
);

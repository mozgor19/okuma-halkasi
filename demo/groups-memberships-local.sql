-- Local synthetic account memberships; never run on production data.
INSERT INTO reading_groups (id,name,binding_name) VALUES ('second','İkinci Okuma Grubu','GROUP_SECOND');
INSERT INTO reading_group_memberships (account_member_id,group_id,member_id,scheme,color_mode)
  VALUES (1,'second',1,'catalogue','light');
DELETE FROM reading_group_memberships WHERE account_member_id = 3;

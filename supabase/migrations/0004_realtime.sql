-- Active les tables dans la publication Realtime de Supabase
alter publication supabase_realtime add table invitations;
alter publication supabase_realtime add table checkins;
alter publication supabase_realtime add table overflow_assignments;
alter publication supabase_realtime add table tables;

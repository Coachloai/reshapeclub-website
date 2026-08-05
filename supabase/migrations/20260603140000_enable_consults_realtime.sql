-- Enable Supabase Realtime on the consults table
ALTER PUBLICATION supabase_realtime ADD TABLE consults;
ALTER TABLE consults REPLICA IDENTITY FULL;

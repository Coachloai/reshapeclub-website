-- Enable Supabase Realtime on the leads table so the dashboard
-- receives INSERT / UPDATE / DELETE events over a websocket.
ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- Full replica identity lets Realtime include the complete old row
-- on UPDATE and DELETE events (needed so the client can match by id).
ALTER TABLE leads REPLICA IDENTITY FULL;

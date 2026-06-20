-- Enable realtime for helpdesk tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'helpdesk_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE helpdesk_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'helpdesk_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE helpdesk_tickets;
  END IF;
END $$;

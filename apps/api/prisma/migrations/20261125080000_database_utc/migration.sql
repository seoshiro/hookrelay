-- Prisma's pg adapter sends timestamps without an offset; pin the session time zone to UTC
-- so they are never reinterpreted in a server-local zone.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END $$;

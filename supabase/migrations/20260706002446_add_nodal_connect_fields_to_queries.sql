/*
# Add NodalConnect fields to queries table

## Summary
Adds columns to the queries table to support SQL Query and Stored Procedure query types
that are backed by the NodalConnect API.

## Modified Tables
- `queries`
  - New column: `nodal_db_connection_id` (text, nullable) - The NodalConnect database connection ID used for execution
  - New column: `sql_query_text` (text, nullable) - SQL query text for SQL_QUERY executable type
  - New column: `proc_name` (text, nullable) - Stored procedure name for STORED_PROCEDURE executable type

## Notes
1. These columns are only populated when query_type is 'sql' or 'stored_procedure'.
2. The query name field doubles as the executable name in NodalConnect.
3. nodal_db_connection_id stores the connection_id string (e.g. "TMWDEV"), not a UUID reference.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'queries'
    AND column_name = 'nodal_db_connection_id'
  ) THEN
    ALTER TABLE queries ADD COLUMN nodal_db_connection_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'queries'
    AND column_name = 'sql_query_text'
  ) THEN
    ALTER TABLE queries ADD COLUMN sql_query_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'queries'
    AND column_name = 'proc_name'
  ) THEN
    ALTER TABLE queries ADD COLUMN proc_name text;
  END IF;
END $$;
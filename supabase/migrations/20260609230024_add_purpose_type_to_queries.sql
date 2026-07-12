ALTER TABLE queries ADD COLUMN purpose_type text NOT NULL DEFAULT 'query';

ALTER TABLE queries ADD CONSTRAINT queries_purpose_type_check CHECK (purpose_type IN ('query', 'action'));

UPDATE queries SET purpose_type = 'query' WHERE purpose_type = 'query';

CREATE INDEX idx_queries_purpose_type ON queries(purpose_type);

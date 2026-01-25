-- 1) Drop old PK
ALTER TABLE case_parties
DROP CONSTRAINT case_parties_pkey;

-- 2) Add surrogate primary key
ALTER TABLE case_parties
ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- 3) Make user_id nullable
ALTER TABLE case_parties
ALTER COLUMN user_id DROP NOT NULL;
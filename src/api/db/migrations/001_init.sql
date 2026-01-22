INSERT INTO case_codes (civil, criminal, limited, admin, duty_court) VALUES (0, 0, 0, 0, 0);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_status') THEN
        CREATE TYPE case_status AS ENUM ('open', 'closed', 'sealed', 'appealed', 'duty_court', 'pending');
    END IF;
END $$;
INSERT INTO case_codes (civil, criminal, limited, admin, duty_court) VALUES (1, 1, 1, 1, 1);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_status') THEN
        CREATE TYPE case_status AS ENUM ('open', 'closed', 'sealed', 'appealed', 'duty_court');
    END IF;
END $$;
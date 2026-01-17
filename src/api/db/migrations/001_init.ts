import { Migration } from "../migration";
import { db_create_table } from "../schema/create_table";

export const migration: Migration = {
    id: "001_init",
    async up(db) {
        await db_create_table(db, "users", [
            { name: "discord_id", type: "BIGINT PRIMARY KEY" },
            { name: "roblox_id", type: "BIGINT UNIQUE NOT NULL" },
            { name: "permission", type: "SMALLINT NOT NULL DEFAULT 0" },
            { name: "created", type: "TIMESTAMP NOT NULL DEFAULT now()" },
        ]);

        await db_create_table(db, "case_codes", [
            { name: "id", type: "SERIAL PRIMARY KEY" },
            { name: "civil", type: "INT NOT NULL DEFAULT 0" },
            { name: "criminal", type: "INT NOT NULL DEFAULT 0" },
            { name: "limited", type: "INT NOT NULL DEFAULT 0" },
            { name: "admin", type: "INT NOT NULL DEFAULT 0" },
            { name: "duty_court", type: "INT NOT NULL DEFAULT 0" },
            { name: "update_at", type: "TIMESTAMP DEFAULT now()" },
        ]);

        await db.file_query("./001_init.sql");

        await db_create_table(db, "cases", [
            { name: "case_code", type: "VARCHAR(16) PRIMARY KEY" },
            { name: "judge", type: "BIGINT REFERENCES users(discord_id)" },
            { name: "card_link", type: "VARCHAR(128)" },
            { name: "channel", type: "BIGINT" },
            { name: "status", type: "case_status NOT NULL DEFAULT 'open'" },
            { name: "created_at", type: "TIMESTAMP DEFAULT now()" },
            { name: "updated_at", type: "TIMESTAMP DEFAULT now()" },
        ]);

        await db_create_table(db, "case_parties", [
            { name: "case_code", type: "VARCHAR(16) REFERENCES cases(case_code) ON DELETE CASCADE" },
            { name: "user_id", type: "BIGINT REFERENCES users(discord_id)" },
            { name: "role", type: "VARCHAR(16) CHECK (role IN ('plaintiff', 'defendant', 'p_counsel', 'd_counsel'))"}
        ], ["case_code", "user_id", "role"]);

        await db_create_table(db, "filings", [
            { name: "filing_id", type: "VARCHAR(16) PRIMARY KEY" },
            { name: "case_code", type: "VARCHAR(16) REFERENCES cases(case_code) ON DELETE CASCADE" },
            { name: "party", type: "VARCHAR(16) NOT NULL" },
            { name: "filed_by", type: "BIGINT REFERENCES users(discord_id)" },
            { name: "filed_at", type: "TIMESTAMP NOT NULL DEFAULT now()" },
        ]);

        await db_create_table(db, "filing_types", [
            { name: "filing_id", type: "VARCHAR(16) REFERENCES filings(filing_id) ON DELETE CASCADE" },
            { name: "type", type: "VARCHAR(32)" },
        ], ["filing_id", "type"]);

        await db_create_table(db, "filing_documents", [
            { name: "filing_id", type: "VARCHAR(16) REFERENCES filings(filing_id) ON DELETE CASCADE" },
            { name: "doc_link", type: "VARCHAR(128)" },
        ], ["filing_id", "doc_link"]);
    }
}
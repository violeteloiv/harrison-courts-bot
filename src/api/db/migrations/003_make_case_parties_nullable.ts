import path from "path";

import { Migration } from "../migration";
export const migration: Migration = {
    id: "003_make_case_parties_nullable",
    async up(db) {
        await db.file_query(path.join(__dirname, "../migrations/003_make_case_parties_nullable.sql"));
    }
}

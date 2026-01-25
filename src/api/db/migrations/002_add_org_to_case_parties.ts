import path from "path";

import { Migration } from "../migration";
export const migration: Migration = {
    id: "002_add_org_to_case_parties",
    async up(db) {
        await db.file_query(path.join(__dirname, "002_add_org_to_case_parties.sql"));
    }
}
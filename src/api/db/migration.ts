import { DatabaseClient } from "./client";

/**
 * Defines what a migration is, characteristically
 * it is an id along with a function which modifies
 * the database while preserving data.
 */
export interface Migration {
    id: string;
    up(db: DatabaseClient): Promise<void>;
}
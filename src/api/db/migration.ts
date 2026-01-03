import { DatabaseClient } from "./client";

export interface Migration {
    id: string;
    up(db: DatabaseClient): Promise<void>;
}
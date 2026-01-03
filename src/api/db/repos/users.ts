import { DatabaseClient } from "../client";
import { Repository } from "../repository";

export type User = {
    discord_id: number,
    roblox_id: number,
    permission: number,
    created: Date,
}

export class UserRepository extends Repository<User> {
    constructor(db: DatabaseClient) {
        super(db, "users", "discord_id", []);
    }
}
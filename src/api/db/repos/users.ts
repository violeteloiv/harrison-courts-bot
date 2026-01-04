import { DatabaseClient } from "../client";
import { Repository } from "../repository";

export type User = {
    discord_id: string,
    roblox_id: string,
    permission: number,
    created: Date,
}

export class UsersRepository extends Repository<User> {
    constructor(db: DatabaseClient) {
        super(db, "users", "discord_id", []);
    }
}
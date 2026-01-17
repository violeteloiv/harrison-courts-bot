import { DatabaseClient } from "../client";
import { Repository } from "../repository";

/**
 * The particular information regarding a user
 * in the database.
 */
export type User = {
    discord_id: string,
    roblox_id: string,
    permission: number,
    created?: Date,
}

/**
 * Repository for interfacing with the `users` table.
 * 
 * @remarks The primary key must be explicitly stated
 * for some reason. I do not know why the constructor
 * doesn't work help me.
 * 
 * @example
 * ```TS
 * const repo = new UsersRepository(db);
 * const user = await repo.get_by_id(discord_id);
 * console.log(user.permission);
 * ```
 */
export class UsersRepository extends Repository<User> {
    protected primary_key: keyof User = "discord_id";

    /**
     * Creates a new UsersRepository.
     * 
     * @param db Database client used to execute queries.
     */
    constructor(db: DatabaseClient) {
        super(db, "users", "discord_id", []);
    }
}
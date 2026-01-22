import noblox from "noblox.js";

/**
 * Check if a user has a rank in a roblox group.
 * 
 * @param user_id The roblox ID of the user
 * @param group_id The group ID
 * @param rank_name The rank name to check against
 * @returns A true or false value
 */
export async function user_has_rank(
    user_id: number, 
    group_id: number, 
    rank_name: string
): Promise<boolean> {
    try {
        const user_rank = await noblox.getRankNameInGroup(group_id, user_id);
        return user_rank.toLowerCase() === rank_name.toLowerCase();
    } catch {
        return false;
    }
}

/**
 * Checks if a username exists on roblox
 * 
 * @param username The username to check
 * @returns A true or false value
 */
export async function username_exists(username: string): Promise<boolean> {
    try {
        await noblox.getIdFromUsername(username);
        return true;
    } catch {
        return false;
    }
}
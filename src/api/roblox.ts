import noblox from "noblox.js";

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

export async function username_exists(username: string): Promise<boolean> {
    try {
        await noblox.getIdFromUsername(username);
        return true;
    } catch {
        return false;
    }
}
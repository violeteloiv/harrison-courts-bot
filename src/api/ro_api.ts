import noblox from "noblox.js";

export async function isUserInGroup(userId: number, groupId: number, rankName: string): Promise<boolean> {
    try {
        const userRole = await noblox.getRankNameInGroup(groupId, userId);
        return userRole.toLowerCase() == rankName.toLowerCase();
    } catch (error) {
        Promise.reject(error);
        return false;
    }
}

export async function doesUsernameExist(username: string): Promise<boolean> {
    try {
        let user_id = await noblox.getIdFromUsername(username);
        console.log(user_id);
        console.log(user_id != null);
        if (user_id != null) return true;
        return false;
    } catch (error) {
        return false;
    }
}
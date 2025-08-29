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
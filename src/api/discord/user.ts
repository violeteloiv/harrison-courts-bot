import { client } from "./client";

/**
 * A function which gets the roles for a particular user based
 * on their discord nickname.
 * 
 * @param discord_nickname The discord nickname of the user
 * @param guild_id The id of the guild we want roles from
 * @returns A list of roles in string form
 */
export async function get_roles_from_user(discord_nickname: string, guild_id: string): Promise<string[]> {
    const guild = await client.guilds.fetch(guild_id);
    const member = guild.members.cache.find(m => m.nickname === discord_nickname);
    if (!member) {
        throw new Error("Member not Found");
    }

    return member.roles.cache.map(r => r.name);
}
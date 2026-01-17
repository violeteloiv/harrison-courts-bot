import { ChatInputCommandInteraction, GuildMember, User } from "discord.js";
import { COURT_REGISTERED_ROLE_ID } from "../../config";

type GuildNickname = {
    member: GuildMember,
    nickname: string,
}

/**
 * Retrieves the guild member and nickname of a user based on the interaction and the user object
 * supplied.
 * 
 * @param interaction The current interaction that the user is engaging in.
 * @param user The user which is being fetched
 * @returns A GuildNickname which returns the user as a GuildMember and the nickname of the User.
 */
export async function fetch_guild_member_and_nickname(interaction: ChatInputCommandInteraction, user: User): Promise<GuildNickname> {
    let member: GuildMember;
    if (user instanceof GuildMember) {
        member = user;
    } else {
        member = await interaction.guild!.members.fetch(user.id);
    }
    return { member, nickname: member.nickname ?? member.displayName };
}

/**
 * Confirms that the user is a verified member of the build.
 * 
 * @param member The member you which to check.
 * @returns A boolean.
 */
export function is_verified(member: GuildMember): boolean {
	return member.roles.cache.some(r => r.name == "Verified");
}

/**
 * Assigns the registered role to a user within the courts server.
 * 
 * @param member The member you wish to assign the role to
 */
export async function assign_registered_role(member: GuildMember) {
    const role = member.guild.roles.cache.get(COURT_REGISTERED_ROLE_ID);
    if (role) await member.roles.add(role);
}
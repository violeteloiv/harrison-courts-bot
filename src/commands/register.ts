import noblox from "noblox.js";
import { CommandInteraction, SlashCommandBuilder, GuildMember, EmbedBuilder, ChatInputCommandInteraction, User } from "discord.js";
import { getPermissionFromDiscordID, getUserFromDiscordID, insertUser } from "../database/db_api";
import { permissions_list } from "../config";

export const data = new SlashCommandBuilder()
    .setName("register")
	.addUserOption(option => 
		option
			.setName("user")
			.setDescription("User to update [County Judge+]")
			.setRequired(false)
	)
    .setDescription("Registers a user in the system.");

function getPermissionString(perm: number): string {
	let str = "- **Permissions:**";
	if ((perm & permissions_list.RESIDENT) > 0) {
		str += " `Resident`,";
	}

	if ((perm & permissions_list.PROSECUTOR) > 0) {
		str += " `Prosecutor`,";
	} else if ((perm & permissions_list.ATTORNEY) > 0) {
		str += " `Attorney`,";
	}

	if ((perm & permissions_list.JUDGE) > 0) {
		str += " `Judge`,";
	}

	if ((perm & permissions_list.CLERK) > 0) {
		str += " `Clerk`,";
	}

	if ((perm & permissions_list.ADMINISTRATOR) > 0) {
		str += " `Admin`,";
	}

	if (perm == 0) {
		str += " `None`,";
	}

	str = str.slice(0, -1);

	return str;
}

export async function register_user(interaction: ChatInputCommandInteraction, targetUser: User | null) {
	// Ensure this is being run inside of a discord server.
	// TODO: Do a check to make sure this is being done in specific discord servers.
	let member = interaction.member;
	if (!member || !interaction.inGuild()) {
		const embed = new EmbedBuilder()
				.setTitle("Registration Error")
				.setDescription("You are not running this inside of a discord server. Please ensure that you do so to get the necessary permissions.")
				.setColor("#d93a3a")
				.setTimestamp();

		return interaction.reply({ embeds: [embed] });
	}

	// Get the user being updated in this interaction.
	let user_to_update;
	if (targetUser) {
		let runner_discord_id = interaction.user.id;
		// TODO: Error checking
		let permission = await getPermissionFromDiscordID(runner_discord_id);
		if ((permission & permissions_list.JUDGE_PLUS) > 0) {
			user_to_update = targetUser;
		} else {
			const embed = new EmbedBuilder()
				.setTitle("Registration Error")
				.setDescription("You do not have the permissions necessary. You must be a County Judge or above to register someone.")
				.setColor("#d93a3a")
				.setTimestamp();

			return interaction.reply({ embeds: [embed] });
		}
	} else {
		user_to_update = interaction.user;
	}

	// Get the discord nickname.
	let discord_id = user_to_update.id;
	let discord_nickname;
	if (user_to_update instanceof GuildMember) {
    	discord_nickname = user_to_update.nickname ?? user_to_update.displayName;
  	} else {
    	user_to_update = await interaction.guild!.members.fetch(discord_id);
    	discord_nickname = user_to_update.nickname ?? user_to_update.displayName;
  	}

	// Ensure that the user has verified before running this command.
	const roleNames = user_to_update.roles.cache.map(r => r.name);
	if (!roleNames.includes("Verified")) {
		return interaction.reply("Please verify with RoVer before running this command.");
	}

	// Now, get the roblox ID using the API.
	let roblox_id;
	try {
		roblox_id = await noblox.getIdFromUsername(discord_nickname);
	} catch (error) {
		return interaction.reply(`${error}`);
	}
	
	// Determine the permissions based on the roles of the user and positions in groups.
	let permission = 0;
	
	// Use the role in the discord to determine if they are a resident.
	if (roleNames.includes("Resident")) {
		permission = permission | permissions_list.RESIDENT;
	}

	// TODO: Link with central BAR database when it exists to avoid issues with clerks who are also licensed attorneys not getting attorney positions.
	if (roleNames.includes("Licensed Attorney")) {
		permission = permission | permissions_list.ATTORNEY;
	}

	// TODO: Use the roblox group to determine if an individual is a prosecutor.
	if (roleNames.includes("District Attorney") || roleNames.includes("District Attorney's Office")) {
		permission = permission | permissions_list.PROSECUTOR;
	}

	// TODO: Use the roblox group to determine if an individual is a county judge.
	if ((roleNames.includes("Judge") && roleNames.includes("County Judge")) || roleNames.includes("Justice of the Peace")) {
		permission = permission | permissions_list.COUNTY_JUDGE;
	}

	// TODO: Use the roblox group to determine if an individual is a deputy clerk.
	if (roleNames.includes("Deputy Clerk")) {
		permission = permission | permissions_list.DEPUTY_CLERK;
	}

	// TODO: Use the roblox group to determine if an individual is a circuit judge.
	if (roleNames.includes("Judge") && roleNames.includes("Circuit Judge")) {
		permission = permission | permissions_list.CIRCUIT_JUDGE;
	}

	// TODO: Use the roblox group to determine if an individual is a deputy clerk.
	if (roleNames.includes("Chief Clerk")) {
		permission = permission | permissions_list.CHIEF_CLERK;
	}

	// TODO: Use the roblox group and roblox IDs to determine if an individual is an administrator.
	if (roleNames.includes("Chief Judge") || roblox_id == 370917506) {
		permission = permission | permissions_list.ADMINISTRATOR;
	}

	// Check if the target user is already in the database.
	let user = await getUserFromDiscordID(discord_id);
	if (user) {
		let description = `<@${discord_id}> has been updated:\n`;
		if (user.discord_id != discord_id) {
			description += `- **Discord ID:** ${discord_id}\n`;
		}
		if (user.roblox_id != roblox_id) {
			description += `- **Roblox ID:** ${roblox_id}\n`;
		}
		if (user.permission != permission) {
			description += getPermissionString(permission);
		}

		if (description ==  `<@${discord_id}> has been updated:\n`) {
			description = "Already up to date! Thank you for checking in :)";
		}

		const embed = new EmbedBuilder()
			.setTitle("Registration Updated!")
			.setDescription(description)
			.setColor("#9853b5")
			.setTimestamp()

		// Add the registered role to the member.
		const registered_role = interaction.guild?.roles.cache.get("1140761936909320293");
		await user_to_update.roles.add(registered_role!);

		await insertUser(discord_id, roblox_id, permission);

		return interaction.reply({ embeds: [embed]});
	} else {
		const embed = new EmbedBuilder()
			.setTitle("Registration Successful!")
			.setDescription(`<@${discord_id}> has been added to the database:\n- **Discord ID:** ${discord_id}\n- **Roblox ID:** ${roblox_id}\n${getPermissionString(permission)}`)
			.setColor("#9853b5")
			.setTimestamp()

		// Add the registered role to the member.
		const registered_role = interaction.guild?.roles.cache.get("1140761936909320293");
		await user_to_update.roles.add(registered_role!);

		await insertUser(discord_id, roblox_id, permission);

		return interaction.reply({ embeds: [embed]});
	}
}

export async function execute(interaction: CommandInteraction) {
	// Check if a user is specified.
	const chatInteraction = interaction as ChatInputCommandInteraction;
	const targetUser = chatInteraction.options.getUser("user", false);

	return await register_user(chatInteraction, targetUser);
}

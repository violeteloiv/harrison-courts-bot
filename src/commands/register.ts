import noblox from "noblox.js";
import { CommandInteraction, SlashCommandBuilder, GuildMember, EmbedBuilder, ChatInputCommandInteraction, User } from "discord.js";
import { getPermissionFromDiscordID, getUserFromDiscordID, insertUser } from "../database/db_api";
import { permissions_list } from "../config";
import { getBarDatabaseDataFromUsername } from "../database/sheet_api";
import { createErrorEmbed, getPermissionString } from "../helper/format";
import { isUserInGroup } from "../database/ro_api";

export const data = new SlashCommandBuilder()
    .setName("register")
	.addUserOption(option => 
		option
			.setName("user")
			.setDescription("User to update [County Judge+]")
			.setRequired(false)
	)
    .setDescription("Registers a user in the system.");

const COURTS_SERVER_ID = "967957262297624597";
const DA_GROUP_ID = 32985413;
const COURTS_GROUP_ID = 32305960;

export async function register_user(interaction: ChatInputCommandInteraction, targetUser: User | null) {
	// Ensure this is being run inside of a discord server.
	// TODO: Do a check to make sure this is being done in cop discords.
	let member = interaction.member;
	if (!member || !interaction.inGuild() || interaction.guild?.id != COURTS_SERVER_ID) {
		return interaction.reply({ embeds: [createErrorEmbed("Registration Error", "You are not running this inside of a discord server. Please ensure that you do so to get the necessary permissions.")] });
	}

	// Get the user being updated in this interaction.
	let user_to_update;
	if (targetUser && targetUser != interaction.user) {
		let runner_discord_id = interaction.user.id;
		let permission;
		try {
			permission = await getPermissionFromDiscordID(runner_discord_id);
		} catch (error) {
			return interaction.reply({ embeds: [createErrorEmbed("Bot Error", `Please message <@344666620419112963> with this error:\n ${error}`)] });
		}

		if ((permission & permissions_list.JUDGE_PLUS) > 0) {
			user_to_update = targetUser;
		} else {
			return interaction.reply({ embeds: [createErrorEmbed("Registration Error", "You do not have the permissions necessary. You must be a County Judge or above to register someone.")] });
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
		return interaction.reply({ embeds: [createErrorEmbed("Registration Error", "Please verify with RoVer or the Harrison County Main Bot first.")] });
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

	let bar_data = await getBarDatabaseDataFromUsername(discord_nickname);
	if (bar_data) {
		if (bar_data.status == "Active") {
			permission = permission | permissions_list.ATTORNEY;
		}
	}

	if (await isUserInGroup(roblox_id, DA_GROUP_ID, "Assistant District Attorney")
			|| await isUserInGroup(roblox_id, DA_GROUP_ID, "Senior Assistant District Attorney")
			|| await isUserInGroup(roblox_id, DA_GROUP_ID, "Chief Assistant District Attorney")
			|| await isUserInGroup(roblox_id, DA_GROUP_ID, "Deputy District Attorney")
			|| await isUserInGroup(roblox_id, DA_GROUP_ID, "District Attorney")) {
		permission = permission | permissions_list.PROSECUTOR;
	}

	if (await isUserInGroup(roblox_id, COURTS_GROUP_ID, "Justice of the Peace")
			|| await isUserInGroup(roblox_id, COURTS_GROUP_ID, "County Judge")) {
		permission = permission | permissions_list.COUNTY_JUDGE;
	}

	if (await isUserInGroup(roblox_id, COURTS_GROUP_ID, "Deputy Clerk")) {
		permission = permission | permissions_list.DEPUTY_CLERK;
	}

	if (await isUserInGroup(roblox_id, COURTS_GROUP_ID, "Circuit Judge")
			|| await isUserInGroup(roblox_id, COURTS_GROUP_ID, "Chief Judge")) {
		permission = permission | permissions_list.CIRCUIT_JUDGE;
	}

	if (await isUserInGroup(roblox_id, COURTS_GROUP_ID, "Chief Clerk")) {
		permission = permission | permissions_list.CHIEF_CLERK;
	}

	if (await isUserInGroup(roblox_id, COURTS_GROUP_ID, "Chief Judge") 
			|| await isUserInGroup(roblox_id, COURTS_GROUP_ID, "Administrative Judge")		
			|| roblox_id == 370917506) {
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

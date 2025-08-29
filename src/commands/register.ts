import noblox from "noblox.js";
import { CommandInteraction, SlashCommandBuilder, GuildMember, EmbedBuilder, ChatInputCommandInteraction, User, ChannelType, CategoryChannel, PermissionFlagsBits } from "discord.js";
import { getPermissionFromDiscordID, getUserFromDiscordID, insertUser } from "../api/db_api";
import { permissions_list } from "../config";
import { getBarDatabaseDataFromUsername } from "../api/sheet_api";
import { createErrorEmbed, getPermissionString } from "../helper/format";
import { isUserInGroup } from "../api/ro_api";
import { client } from "../client";
import { createCategoryNextTo, removeCategory } from "../api/trello_api";
import { register } from "module";

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
const MAIN_GROUP_ID = 15665829;

interface RegisterData {
	old_perms?: number,
	new_perms?: number,
	username?: string,
	discord_id?: string,
}

export async function register_user(interaction: ChatInputCommandInteraction, targetUser: User | null): Promise<RegisterData> {
	// Ensure this is being run inside of a discord server.
	// TODO: Do a check to make sure this is being done in cop discords.
	let member = interaction.member;
	if (!member || !interaction.inGuild() || interaction.guild?.id != COURTS_SERVER_ID) {
		interaction.reply({ embeds: [createErrorEmbed("Registration Error", "You are not running this inside of a discord server. Please ensure that you do so to get the necessary permissions.")] });
		return { new_perms: -1 };
	}

	// Get the user being updated in this interaction.
	let user_to_update;
	if (targetUser && targetUser != interaction.user) {
		let runner_discord_id = interaction.user.id;
		let permission;
		try {
			permission = await getPermissionFromDiscordID(runner_discord_id);
		} catch (error) {
			interaction.reply({ embeds: [createErrorEmbed("Bot Error", `Please message <@344666620419112963> with this error:\n ${error}`)] });
			return { new_perms: -1 };
		}

		if ((permission & permissions_list.JUDGE_PLUS) > 0) {
			user_to_update = targetUser;
		} else {
			interaction.reply({ embeds: [createErrorEmbed("Registration Error", "You do not have the permissions necessary. You must be a County Judge or above to register someone.")] });
			return { new_perms: -1 };
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
		interaction.reply({ embeds: [createErrorEmbed("Registration Error", "Please verify with RoVer or the Harrison County Main Bot first.")] });
		return { new_perms: -1 };
	}

	// Now, get the roblox ID using the API.
	let roblox_id;
	try {
		roblox_id = await noblox.getIdFromUsername(discord_nickname);
	} catch (error) {
		interaction.reply({ embeds: [createErrorEmbed("Bot Error", `Please message <@344666620419112963> with this error:\n ${error}`)] });
		return { new_perms: -1 };
	}
	
	// Determine the permissions based on the roles of the user and positions in groups.
	let permission = 0;
	
	// Use the role in the discord to determine if they are a resident.
	if (await isUserInGroup(roblox_id, MAIN_GROUP_ID, "Resident")) {
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

		interaction.reply({ embeds: [embed]});
		return {
			new_perms: permission, 
			old_perms: user.permission,
			username: discord_nickname,
			discord_id: discord_id,
		};
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

		interaction.reply({ embeds: [embed]});
		return {
			new_perms: permission, 
			old_perms: -1,
			username: discord_nickname,
			discord_id: discord_id,
		};
	}
}

export async function execute(interaction: CommandInteraction) {
	// Check if a user is specified.
	const chatInteraction = interaction as ChatInputCommandInteraction;
	const targetUser = chatInteraction.options.getUser("user", false);

	let register_data: RegisterData = await register_user(chatInteraction, targetUser);
	if (register_data.new_perms == -1) return;

	let guild = await client.guilds.fetch(COURTS_SERVER_ID);
	await guild.channels.fetch();
	
	// Someone just got judicial perms!!!
	if (((register_data.old_perms! & permissions_list.COUNTY_JUDGE) == 0 && (register_data.new_perms! & permissions_list.COUNTY_JUDGE) > 0)
			|| (register_data.old_perms == -1 && (register_data.new_perms! & permissions_list.COUNTY_JUDGE) > 0)) {
		// Create the category
		const refCategory = guild.channels.cache.find((c): c is CategoryChannel => c.name === "Duty Court" && c.type === ChannelType.GuildCategory);
		const category = await guild.channels.create({
			name: `Chambers of ${register_data.username!}`,
			type: ChannelType.GuildCategory,
		})
		category.setPosition(refCategory?.position! - 1);

		// Create an information channel under the category.
		await guild.channels.create({
			name: "chamber-information",
			type: ChannelType.GuildText,
			parent: category.id,
			permissionOverwrites: [
				{
					id: guild.roles.everyone.id,
					deny: [
						PermissionFlagsBits.AddReactions,
						PermissionFlagsBits.AttachFiles,
						PermissionFlagsBits.CreatePrivateThreads,
						PermissionFlagsBits.CreatePublicThreads,
						PermissionFlagsBits.SendMessages
					],
					allow: [
						PermissionFlagsBits.ViewChannel
					]
				},
				{
					id: guild.roles.cache.find(role => role.name == "Deputy Clerk")!.id,
					allow: [
						PermissionFlagsBits.SendMessages
					]
				},
				{
					id: guild.roles.cache.find(role => role.name == "Chief Clerk")!.id,
					allow: [
						PermissionFlagsBits.SendMessages
					]
				},
				{
					id: register_data.discord_id!,
					allow: [
						PermissionFlagsBits.SendMessages
					]
				}
			]
		});

		try {
			await createCategoryNextTo(`Docket of ${register_data.username!}`, "68929e8db5fe44776b435721", "6892a37a0cf6d3d722bc6bec");
		} catch (error) {
			return interaction.followUp({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)]});
		}
	}

	
	// Someone lost their judicial perms :(
	if (register_data.old_perms != -1) {
		if ((register_data.old_perms! & permissions_list.COUNTY_JUDGE) > 0 && (register_data.new_perms! & permissions_list.COUNTY_JUDGE) == 0) {
			const category = guild.channels.cache.find(
				channel => channel.name == `Chambers of ${register_data.username!}` && channel.type == ChannelType.GuildCategory
			) as CategoryChannel;

			// TODO: Handle the transfer and status of case channels here.

			category.children.cache.forEach(async (channel) => {
				await channel.delete();
			})

			category?.delete();

			// TODO: Handle the transfer of trello cards here.

			try {
				await removeCategory(`Docket of ${register_data.username!}`, "68929e8db5fe44776b435721");
			} catch (error) {
				return interaction.followUp({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)]});
			}
		}
	}
}

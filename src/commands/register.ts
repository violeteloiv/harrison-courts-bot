import { CategoryChannel, ChannelType, ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, User } from "discord.js";
import noblox from "noblox.js";

import { DatabaseClient } from "../api/db/client";
import { UsersRepository } from "../api/db/repos/users";
import { client } from "../api/discord/client";
import { assign_registered_role, fetch_guild_member_and_nickname, is_verified } from "../api/discord/guild";
import { build_embed, create_error_embed, debug_embed } from "../api/discord/visual";
import { compute_permissions, get_permission_string, permissions_list } from "../api/permissions";
import { create_list_next_to, remove_list } from "../api/trello/list";

import { AWAITING_ARCHIVING_COUNTY_LIST_ID, COUNTY_COURT_BOARD_ID, COURTS_SERVER_ID } from "../config";

const db = new DatabaseClient();
const users_repo = new UsersRepository(db);

export const data = new SlashCommandBuilder()
    .setName("register")
	.addUserOption(option => 
		option
			.setName("user")
			.setDescription("User to update [County Judge+]")
			.setRequired(false)
	)
    .setDescription("Registers a user in the system.");

type RegisterData = {
	old_perms?: number,
	new_perms?: number,
	username?: string,
	discord_id?: string,
}

export async function register_user_in_db(interaction: ChatInputCommandInteraction, target_user: User | null): Promise<RegisterData> {
	// TODO: Do a check to make sure this is being done in cop discords as well.
	
	// Confirm that the individual is in the courts server.
	if (!interaction.inGuild() || interaction.guild?.id !== COURTS_SERVER_ID) {
		interaction.editReply({ embeds: [create_error_embed("Registration Error", "You must run this inside the court server.")] });
		return { new_perms: -1 };
	}

	// Get the user to register 
	let user_to_register: User;
	if (target_user && target_user.id !== interaction.user.id) {
		const permission = (await users_repo.get_by_id(interaction.user.id))?.permission;
		if (!permission) {
			interaction.editReply({ embeds: [create_error_embed("Registration Error", "Unable to retrieve the permission from the Users Repository.")] });
			return { new_perms: -1 };
		}

		let debug = debug_embed(permission.toString(2));
		if (((permission as number) & permissions_list.JUDGE_PLUS) === 0) {
			interaction.editReply({ embeds: [create_error_embed("Registration Error", "You need County Judge+ permissions."), debug] });
			return { new_perms: -1 };
		}

		user_to_register = target_user;
	} else {
		user_to_register = interaction.user;
	}

	const { member, nickname } = await fetch_guild_member_and_nickname(interaction, user_to_register);

	// Confirm that the user is already verified (this is how the roblox nickname is retrieved)
	if (!is_verified(member)) {
		if (nickname !== interaction.user.displayName) {
			interaction.editReply({ embeds: [create_error_embed("Registration Error", `Please verify ${nickname} with rover first.`)]});
		} else {
			interaction.editReply({ embeds: [create_error_embed("Registration Error", "Please verify with rover first.")] });
		}
    	return { new_perms: -1 };
	}

	// Get the roblox id
	const roblox_id = await noblox.getIdFromUsername(nickname).catch(err => {
		interaction.editReply({ embeds: [create_error_embed("Bot Error", `${err}`)] });
		return -1;
	});
	if (roblox_id === -1) return { new_perms: -1 };

	const new_perms = await compute_permissions(roblox_id, nickname);
	const db_user = await users_repo.get_by_id(member.id);

	let embed: EmbedBuilder;
	if (db_user) {
		let description = `<@${member.id}> has been updated:\n`;
		if (db_user.discord_id !== member.id) description += `- **Discord ID:** ${member.id}\n`;
		if (Number(db_user.roblox_id) !== roblox_id) description += `- **Roblox ID:** ${roblox_id}\n`;
		if (db_user.permission !== new_perms) description += get_permission_string(new_perms);

		if (description === `<@${member.id}> has been updated:\n`) description = "Already up to date!";

		embed = build_embed("Registration Updated!", description);
	} else {
		const description = `<@${member.id}> has been added to the database:\n- **Discord ID:** ${member.id}\n- **Roblox ID:** ${roblox_id}\n${get_permission_string(new_perms)}`;
		embed = build_embed("Registration Successful!", description);
	}

	await users_repo.upsert({ discord_id: member.id, roblox_id: String(roblox_id), permission: new_perms });
	await assign_registered_role(member);

	await interaction.editReply({ embeds: [embed] });

	return {
		new_perms: new_perms,
		old_perms: db_user?.permission ?? -1,
		username: nickname,
		discord_id: member.id,
	};
}

export async function execute(interaction: CommandInteraction) {
	const chat_interaction = interaction as ChatInputCommandInteraction;
	await interaction.deferReply();

	const target_user = chat_interaction.options.getUser("user", false);
	const register_data = await register_user_in_db(chat_interaction, target_user);
	if (register_data.new_perms === -1) return;

	const guild = await client.guilds.fetch(COURTS_SERVER_ID);
	await guild.channels.fetch();

	// If the user became a county judge, then create a category and channel for them. Also create a trello
	// list for their case load.
	const became_county_judge = ((register_data.old_perms! & permissions_list.COUNTY_JUDGE) === 0 &&
		(register_data.new_perms! & permissions_list.COUNTY_JUDGE) > 0) ||
		(register_data.old_perms === -1 && (register_data.new_perms! & permissions_list.COUNTY_JUDGE) > 0);

	if (became_county_judge) {
		const ref_category = guild.channels.cache.find(
			(c): c is CategoryChannel => c.name === "Duty Court" && c.type === ChannelType.GuildCategory
		);

		const category = await guild.channels.create({
			name: `Chambers of ${register_data.username!}`,
			type: ChannelType.GuildCategory,
			position: ref_category?.position! - 1
		});

		const chamber_categories = guild.channels.cache
			.filter(
				(c): c is CategoryChannel => 
					c.type === ChannelType.GuildCategory && 
					c.name.startsWith("Chambers of ") &&
					c.id !== category.id
			)
			.sort((a, b) => a.position - b.position);

		let pos = ref_category?.position! - chamber_categories.size - 1;
		for (const cat of chamber_categories.values()) {
			await cat.setPosition(pos++);
		}
		await category.setPosition(pos++);

		await guild.channels.create({
			name: "chamber-information",
			type: ChannelType.GuildText,
			parent: category.id,
			permissionOverwrites: [
				{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
				{ id: guild.roles.cache.find(r => r.name === "Deputy Clerk")!.id, allow: [PermissionFlagsBits.SendMessages] },
				{ id: guild.roles.cache.find(r => r.name === "Registrar")!.id, allow: [PermissionFlagsBits.SendMessages] },
				{ id: guild.roles.cache.find(r => r.name === "Chief Judge")!.id, allow: [PermissionFlagsBits.SendMessages] },
				{ id: register_data.discord_id!, allow: [PermissionFlagsBits.SendMessages] }
			]
		});

		try {
			await create_list_next_to(`Docket of ${register_data.username!}`, COUNTY_COURT_BOARD_ID, AWAITING_ARCHIVING_COUNTY_LIST_ID);
		} catch (error) {
			return interaction.followUp({ embeds: [create_error_embed("Bot Error", `${error}`)] });
		}
	}

	// If the user is losing their judge permissions, archive and remove the channels and their category. Also create a trello list for their
	// case load.
	if (register_data.old_perms! & permissions_list.COUNTY_JUDGE && !(register_data.new_perms! & permissions_list.COUNTY_JUDGE)) {
		// TODO: Archive active cases and return them to awaiting assignment status.
		const category = guild.channels.cache.find(
			c => c.name === `Chambers of ${register_data.username!}` && c.type === ChannelType.GuildCategory
		) as CategoryChannel;

		if (!category) return;
		await category.fetch();

		await Promise.all(category.children.cache.map(c => c.delete()));

		try {
			await remove_list(`Docket of ${register_data.username!}`, COUNTY_COURT_BOARD_ID);
		} catch (error) {
			return interaction.followUp({ embeds: [create_error_embed("Bot Error", `${error}`)] });
		}
	}
}

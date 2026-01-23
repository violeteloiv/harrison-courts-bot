import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder, TextChannel } from "discord.js";

import { DatabaseClient } from "../api/db/client";
import { UsersRepository } from "../api/db/repos/users";
import { create_error_embed } from "../api/discord/visual";
import { permissions_list } from "../api/permissions";
import { execute_form } from "../form/form";
import { create_civil_filing_form, process_civil_filing_form } from "../form/forms/civil_filing_form";

import { BOT_SUCCESS_COLOR } from "../config";

const db = new DatabaseClient();
const users_repo = new UsersRepository(db);

export const data = new SlashCommandBuilder()
    .setName("filecase")
    .addStringOption(option =>
        option
            .setName("type")
            .setDescription("The type of case which to file (Civil, Criminal, Expungement, Special, Appeal, Admin)")
            .setRequired(true)
    )
    .setDescription("Files a case with the court.");

export async function execute(interaction: CommandInteraction) {
    // Get the input data.
    const chatInteraction = interaction as ChatInputCommandInteraction;
    let case_type = chatInteraction.options.getString("type", true).toLowerCase();

    const embed = new EmbedBuilder()
        .setTitle("Processing Request")
        .setDescription("Check your DMs to fill out the form!")
        .setColor(BOT_SUCCESS_COLOR)
        .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true} );

    // Ensure the user has the required permissions to run this command.
    let user = await users_repo.get_by_discord_id(interaction.user.id);
    if (!user)
        return await interaction.editReply({ embeds: [create_error_embed("Permission Error", "You must register with /register before running this command.")] });
    
    // Get the channel the modal was sent in.
    let channel = interaction.channel;
    if (channel?.isTextBased())
        channel = channel as TextChannel;
    else
        return await interaction.editReply({ embeds: [create_error_embed("Permission Error", "You must run this command in a valid discord server.")] });

    let error_message = "The following must be fixed in your submission:\n";

    // Ensure the user has the permission to file the case type.
    if (case_type == "criminal" && (user.permission & permissions_list.PROSECUTOR) == 0) {
        error_message += "- Only prosecutors can file criminal cases.\n";
    }

    if (error_message != "The following must be fixed in your submission:\n") 
        return await interaction.editReply({ embeds: [create_error_embed("Case Submission Error", error_message)] });

    if (case_type == 'civil') {
        let form = create_civil_filing_form();
        let responses = await execute_form(form, interaction.member as GuildMember);
        await process_civil_filing_form(
            { permission: user.permission, id: user.roblox_id, message: responses.message },
            responses.answers
        );
    } else {
        return await interaction.editReply({ embeds: [ create_error_embed("Case Submission Error", `The bot currently does not support filing cases of type ${case_type}. We apologize.`)] });
    }
}
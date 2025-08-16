import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, ModalSubmitInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { getPermissionFromDiscordID } from "../database/db_api";
import { permissions_list } from "../config";
import { botErrorEditReply } from "../helper/format";
import { executeForm } from "../helper/form";
import { createCivilFilingForm, processCivilFilingForm } from "../forms/civil_filing_form";

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
    let jurisdiction = "";

    const embed = new EmbedBuilder()
        .setTitle("Processing Request")
        .setDescription("Check your DMs to fill out the form!")
        .setColor("#9853b5")
        .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true} );

    // Ensure the user has the required permissions to run this command.
    if (!interaction.inCachedGuild()) return;
    const roleNames = interaction.member?.roles.cache.map(r => r.name);
    if (!roleNames.includes("Registered")) return await botErrorEditReply(interaction, "Permission Error", "You must register with /register before running this command.");

    // Get the channel the modal was sent in.
    let channel = interaction.channel;
    if (channel?.isTextBased()) {
        channel = channel as TextChannel;
    } else {
        return await botErrorEditReply(interaction, "Permission Error", "You must run this command in a discord server.");
    }

    let error_message = "The following must be fixed in your submission:\n";

    // Get the jurisdiction based on the filing type.
    if (case_type == 'civil' || case_type == 'criminal' || case_type == 'expungement' || case_type == 'special') {
        jurisdiction = "county";
    } else if (case_type == 'appeal' || case_type == 'admin') {
        jurisdiction = "circuit";
    } else {
        error_message += `${case_type} is not a valid case type.\n`;
    }

    // Ensure the user has the permission to file the case type.
    let permission = await getPermissionFromDiscordID(interaction.user.id);
    if (case_type == "criminal" && (permission & permissions_list.PROSECUTOR) == 0) {
        error_message += "- Only prosecutors can file criminal cases.\n";
    }

    if (error_message != "The following must be fixed in your submission:\n") return await botErrorEditReply(interaction, "Case Error", error_message, true);

    if (case_type == 'civil') {
        let form = createCivilFilingForm();
        let responses = await executeForm(form, interaction.member);
        await processCivilFilingForm(
            { permission: permission, id: interaction.user.id, message: responses.message },
            responses.answers
        );
    }
}
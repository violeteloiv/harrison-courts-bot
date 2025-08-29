import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { botErrorEditReply, createErrorEmbed } from "../helper/format";
import { getRobloxIDFromDiscordID } from "../api/db_api";
import noblox from "noblox.js";
import { createTransferPetitionForm, processTransferPetitionForm } from "../forms/transfer_petition_form";
import { executeForm } from "../helper/form";

export const data = new SlashCommandBuilder()
    .setName("transferpetition")
    .setDescription("Creates a transfer petition for consideration by the Circuit Court.");

export async function execute(interaction: CommandInteraction) {
    // Ensure the user has the required permissions to run this command.
    if (!interaction.inCachedGuild()) return;
    const roleNames = interaction.member?.roles.cache.map(r => r.name);
    if (!roleNames.includes("Registered")) return await botErrorEditReply(interaction, "Permission Error", "You must register with /register before running this command.");

    const embed = new EmbedBuilder()
        .setTitle("Processing Request")
        .setDescription("Check your DMs to fill out the form!")
        .setColor("#9853b5")
        .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true} );

    try {
        let roblox_id = await getRobloxIDFromDiscordID(interaction.user.id);
        let username = await noblox.getUsernameFromId(roblox_id);

        let form = createTransferPetitionForm();
        let responses = await executeForm(form, interaction.member);
        await processTransferPetitionForm(
            { message: responses.message, username: username, id: interaction.user.id },
            responses.answers
        );
    } catch (error) {
        const embed = createErrorEmbed(
            "Internal Bot Error",
            `There has been an internal bot error, please contact <@344666620419112963> with the following error message:\n${error}`
        )   
        interaction.editReply({ embeds: [embed] });
    }
}
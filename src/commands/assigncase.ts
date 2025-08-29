import { ChatInputCommandInteraction, CommandInteraction, SlashCommandBuilder, User } from "discord.js";
import { createErrorEmbed } from "../helper/format";
import { getCaseByCaseCode, getUserFromDiscordID } from "../api/db_api";
import { permissions_list } from "../config";

export const data = new SlashCommandBuilder()
    .setName("assigncase")
    .addStringOption(option =>
        option
            .setName("case_id")
            .setDescription("The id of the case")
            .setRequired(true)
    )
    .addUserOption(option =>
        option 
            .setName("judge")
            .setDescription("The judge you are assigning the case to")
            .setRequired(true)
    )
    .setDescription("Assigns a currently pending case to a judge [Clerk+].");

async function verify_inputs(interaction: CommandInteraction, case_id: string, judge_user: User) {
    // Ensure the case id is of the right form.
    if (!case_id.match(/(H)(CV|CR|SP|EX|AP|AD)-([0-9]{4})-([0-9]{2})/)) {
        return await interaction.reply({ embeds: [createErrorEmbed("Parameter Error", "Must submit something of the form HXX-XXXX-XX.")], ephemeral: true });
    }

    // Check if a case exists with the supplied code.
    let court_case;
    try {
        court_case = await getCaseByCaseCode(case_id);
        if (court_case) {
            if (court_case.status == "closed") {
                return await interaction.reply({ embeds: [createErrorEmbed("Parameter Error", "Case Code supplied belongs to a case which is closed.")], ephemeral: true });
            }
        } else {
            return await interaction.reply({ embeds: [createErrorEmbed("Parameter Error", "Case Code supplied does not belong to any case in our database.")], ephemeral: true });
        }
    } catch (error) {
        return await interaction.reply({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }

    // Check if the user is a judge.
    let user;
    try {
        user = await getUserFromDiscordID(judge_user.id);
        if (user) {
            if ((user.permission & permissions_list.JUDGE) == 0) {
                return await interaction.reply({ embeds: [createErrorEmbed("Parameter Error", "User specified is not a judge in the database.")], ephemeral: true });
            }
        } else {
            return await interaction.reply({ embeds: [createErrorEmbed("Parameter Error", "User specified is not registered in the database.")], ephemeral: true });
        }
    } catch (error) {
        return await interaction.reply({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }
}

export async function execute(interaction: CommandInteraction) {
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const case_id = chatInteraction.options.getString("case_id", true);
    const judge_user = chatInteraction.options.getUser("judge", true);

    if (await verify_inputs(interaction, case_id, judge_user)) return;
}
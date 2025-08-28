import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getCardsFromList } from "../database/trello_api";
import { getPermissionFromDiscordID } from "../database/db_api";
import { permissions_list } from "../config";
import { createErrorEmbed } from "../helper/format";

export const data = new SlashCommandBuilder()
    .setName("pendingcases")
    .setDescription("Retrieve a list of cases which are actively pending [Clerk+].");

export async function execute(interaction: CommandInteraction) {
    // Check the permissions of the user.
    let permission = await getPermissionFromDiscordID(interaction.user.id);
    if ((permission & permissions_list.CLERK) == 0 && (permission & permissions_list.JUDGE) == 0 && (permission & permissions_list.ADMINISTRATOR) == 0) {
        return await interaction.reply({ embeds: [createErrorEmbed("Permission Error", "Must be a judge or clerk to run this command.")] });
    }

    const embed = new EmbedBuilder()
        .setTitle("Pending Cases")
        .setColor("#9853b5")
        .setTimestamp()

    let description = "__***Pending County Court Cases:***__\n";

    // TODO: Setup so that if there are a certain amount of cases, it breaks between embeds.

    // Add the pending case data from the county court.
    try {
        let cards = await getCardsFromList("6892a359ff10f18c8b09242d");
        cards.forEach((card) => {
            // Parse the case code out of the description.
            const regex = /\*\*Docket #:\*\*\s*(.*?)\n/;
            const match = card.description.match(regex);

            let label;
            for (let i = 0; i < card.labels.length; i++) {
                if (card.labels[i].name != "PENDING") {
                    label = card.labels[i].name;
                }
            }

            if (match) {
                description += `**${match[1]}**\t| ${label}\t- **Assign By:** <t:${Math.floor(Date.parse(card.deadline) / 1000)}:f>\n`;
            } else {
                throw new Error("Description does not contain Docket #.");
            }
        });
    } catch (error) {
        return await interaction.reply({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n ${error}`)] });
    }

    description += "\n__***Pending Circuit Court Cases:***__\n";

    // Add the pending case data from the circuit court.
    try {
        let cards = await getCardsFromList("6892a4c496df6092610ed6dc");
        cards.forEach((card) => {
            // Parse the case code out of the description.
            const regex = /\*\*Docket #:\*\*\s*(.*?)\n/;
            const match = card.description.match(regex);

            let label;
            for (let i = 0; i < card.labels.length; i++) {
                if (card.labels[i].name != "PENDING") {
                    label = card.labels[i].name;
                }
            }

            if (match) {
                description += `**${match[1]}**\t| ${label}\t- **Assign By:** <t:${Math.floor(Date.parse(card.deadline) / 1000)}:f>\n`;
            } else {
                throw new Error("Description does not contain Docket #.");
            }
        });
    } catch (error) {
        return await interaction.reply({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n ${error}`)] });
    }

    embed.setDescription(description);

    return await interaction.reply({ embeds: [embed] });
}
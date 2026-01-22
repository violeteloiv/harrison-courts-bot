import { CommandInteraction, Embed, EmbedBuilder, Interaction, SlashCommandBuilder } from "discord.js";

import { DatabaseClient } from "../api/db/client";
import { UsersRepository } from "../api/db/repos/users";
import { create_error_embed } from "../api/discord/visual";
import { format_error_info } from "../api/error";
import { permissions_list } from "../api/permissions";
import { map_to_case_card } from "../api/trello/card";
import { get_cards_by_list } from "../api/trello/list";

import { BOT_SUCCESS_COLOR, PENDING_CASES_CIRCUIT_LIST_ID, PENDING_CASES_COUNTY_LIST_ID } from "../config";
import { PaginatedEmbedBuilder } from "../api/discord/page_embed";

export const data = new SlashCommandBuilder()
    .setName("pendingcases")
    .setDescription("Retrieve a list of cases which are actively pending [Clerk+].");

let db = new DatabaseClient();
let users_repo = new UsersRepository(db);

export async function execute(interaction: CommandInteraction) {
    // Check the permissions of the user.
    let user = await users_repo.get_by_id(interaction.user.id);
    if (!user) return await interaction.editReply({ embeds: [create_error_embed("Permission Error", "You must register with the bot with /register first.")] });
    
    let permission = user.permission;
    if ((permission & permissions_list.CLERK) == 0 && (permission & permissions_list.JUDGE) == 0 && (permission & permissions_list.ADMINISTRATOR) == 0)
        return await interaction.reply({ embeds: [create_error_embed("Permission Error", "Must be a judge or clerk to run this command.")] });

    const paginator = new PaginatedEmbedBuilder(
        new EmbedBuilder()
            .setTitle("Pending Cases")
            .setColor(BOT_SUCCESS_COLOR)
    );

    paginator.add("__***Pending County Court Cases:***__");

    // Add the pending case data from the county court.
    try {
        let cards_trello = await get_cards_by_list(PENDING_CASES_COUNTY_LIST_ID);
        let cards_case = cards_trello.map(card => map_to_case_card(card));
        cards_case.forEach((card) => {
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
                paginator.add(`**${match[1]}**\t| ${label}\t- **Assign By:** <t:${Math.floor(Date.parse(card.deadline) / 1000)}:f>`);
            } else {
                throw new Error("Description does not contain Docket #.");
            }
        });
    } catch (error) {
        return await interaction.reply({ embeds: [create_error_embed("Bot Error", `Message <@344666620419112963> with this error:\n ${format_error_info(error as Error)}`)] });
    }

    paginator.new_page();
    paginator.add("__***Pending Circuit Court Cases:***__");

    // Add the pending case data from the circuit court.
    try {
        let cards_trello = await get_cards_by_list(PENDING_CASES_CIRCUIT_LIST_ID);
        let cards_case = cards_trello.map(card => map_to_case_card(card));
        cards_case.forEach((card) => {
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
                paginator.add(`**${match[1]}**\t| ${label}`);
            } else {
                throw new Error("Description does not contain Docket #.");
            }
        });
    } catch (error) {
        return await interaction.reply({ embeds: [create_error_embed("Bot Error", `Message <@344666620419112963> with this error:\n ${format_error_info(error as Error)}`)] });
    }

    return await paginator.send(interaction as Interaction);
}
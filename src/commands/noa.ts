import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, GuildChannel, SlashCommandBuilder, TextChannel } from "discord.js";
import noblox from "noblox.js";

import { DatabaseClient } from "../api/db/client";
import { CaseRole, CasesRepository } from "../api/db/repos/cases";
import { FilingRepository } from "../api/db/repos/filings";
import { UsersRepository } from "../api/db/repos/users";
import { build_embed, create_error_embed } from "../api/discord/visual";
import { create_and_store_noa } from "../api/google/documents";
import { get_bar_data } from "../api/google/sheets";
import { permissions_list } from "../api/permissions";
import { get_by_short_link, update_card } from "../api/trello/card";

import { BOT_SUCCESS_COLOR } from "../config";
import { get_unique_filing_id, update_filing_record } from "../helper/format";

export const data = new SlashCommandBuilder()
    .setName("noa")
    .addStringOption(option =>
        option
            .setName("case_code")
            .setDescription("The case code for the case you wish to file an NOA for.")
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName("party")
            .setDescription("The party for which you are filing an NOA for.")
            .setChoices([
                { name: "Plaintiff", value: "plaintiff" },
                { name: "Defendant", value: "defendant" },
            ])
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName("organization")
            .setDescription("The organization you are representing.")
            .setRequired(false)
    )
    .setDescription("Files an NOA for a case [Attorney]");

const db = new DatabaseClient();
const users_repo = new UsersRepository(db);
const cases_repo = new CasesRepository(db);
const filings_repo = new FilingRepository(db);

export async function execute(interaction: CommandInteraction) {
    await interaction.deferReply();

    // Check the permissions of the user.
    let user = await users_repo.get_by_discord_id(interaction.user.id);
    if (!user) return await interaction.editReply({ embeds: [create_error_embed("Permission Error", "Please Register with /register before running any command.")] });

    if ((user.permission & permissions_list.ATTORNEY) == 0 && (user.permission & permissions_list.ADMINISTRATOR) == 0) {
        return await interaction.editReply({ embeds: [create_error_embed("Permission Error", "Must be an attorney to run this command.")] });
    }

    let username = await noblox.getUsernameFromId(Number(user.roblox_id));

    const chat_interaction = interaction as ChatInputCommandInteraction;
    let case_code = chat_interaction.options.getString("case_code", true);
    let party = chat_interaction.options.getString("party", true);
    let organization = chat_interaction.options.getString("organization", false);

    const processing_embed = new EmbedBuilder()
        .setTitle("Processing")
        .setDescription("Processing your NOA Request!")
        .setColor(BOT_SUCCESS_COLOR)
        .setTimestamp();

    try {
        // Check to see if the case_code corresponds to a valid, open case.
        let court_case = await cases_repo.get_by_id(case_code);
        if (court_case) {
            if (court_case.status == "closed") {
                return await interaction.editReply({ embeds: [create_error_embed("Parameter Error", "Case Code supplied belongs to a case which is closed.")] });
            }
        } else {
            return await interaction.editReply({ embeds: [create_error_embed("Parameter Error", "Case Code supplied does not belong to any case in our database.")] });
        }

        await interaction.editReply({ embeds: [processing_embed ]});

        // Get relevant information
        let bar_data = await get_bar_data(username);

        processing_embed.setDescription("Processing and uploading your NOA!");
        await interaction.editReply({ embeds: [processing_embed] });

        let plaintiff_names = await cases_repo.get_party_names_by_role(court_case.case_code, "plaintiff");
        let defendant_names = await cases_repo.get_party_names_by_role(court_case.case_code, "defendant");

        let filings = await filings_repo.get_filings_for_case(court_case);
        let filing_types = filings.filter(filing => filing.filed_by === user.roblox_id).map(filing => filing.types).flat().map(t => t!.type);
        console.log(filing_types);
        if (!filing_types.includes("Notice of Appearance")) {
            // File the NOA
            let noa = await create_and_store_noa({
                case_id: case_code, plaintiffs: plaintiff_names, defendants: defendant_names,
                presiding_judge: court_case.judge, username: username,
                bar_number: bar_data?.bar_number!, party: party.toLowerCase()
            });

            let filing_id = await get_unique_filing_id();
            await filings_repo.upsert({
                filing_id: filing_id, case_code: court_case.case_code, party: party.toLowerCase(),
                filed_by: user.roblox_id, types: [{ type: "Notice of Appearance" }], documents: [{ doc_link: noa }]
            });

            processing_embed.setDescription('Updating the trello with your NOA...');
            await interaction.editReply({ embeds: [processing_embed ]});

            let card = await get_by_short_link(court_case.card_link);
            card.description = update_filing_record(card.description, ["Notice of Appearance"], [noa], username);
            await update_card(card);

            // Give the user permissions to speak in the channel
            let channel = interaction.guild!.channels.cache.get(court_case.channel)! as GuildChannel;
            channel.permissionOverwrites.edit(interaction.user.id, {
                SendMessages: true,
            });

            let text_channel = channel as TextChannel;
            text_channel.send({
                embeds: [build_embed("New Notice of Appearance", `Attorney <@${interaction.user.id}> (Bar #: ${bar_data?.bar_number!}) has filed a notice of appearance on behalf of the ${party}.`)]
            });

            let role = party === "plaintiff" ? "p_counsel" : "d_counsel";
            if (organization) {
                await cases_repo.add_party(court_case, { user_id: user.roblox_id, role: role as CaseRole, organization: organization });
            } else {
                await cases_repo.add_party(court_case, { user_id: user.roblox_id, role: role as CaseRole, organization: "" });
            }

            processing_embed.setDescription(`You should now be able to speak in <#${court_case.channel}>! Thanks for your patience :)`);
            await interaction.editReply({ embeds: [processing_embed ]});
        } else {
            return await interaction.editReply({ embeds: [create_error_embed("Submission Error", "You can only submit a NOA once per case.")] });
        }
    } catch (error) {
        return await interaction.editReply({ embeds: [create_error_embed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }
}

import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, GuildChannel, SlashCommandBuilder } from "discord.js";
import { getCaseByCaseCode, getPermissionFromDiscordID, insertFiling, updateRepresentingAttorneysUsingCaseCode } from "../api/db_api";
import { permissions_list } from "../config";
import { createErrorEmbed, getCaseTypeFromCaseCode, getUniqueFilingID, updateFilingRecord } from "../helper/format";
import { createAndStoreNOA } from "../api/documents/noa";
import { getBarDatabaseDataFromUsername } from "../api/sheet_api";
import { getCardFromLink, updateTrelloCard } from "../api/trello_api";

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
    .setDescription("Files an NOA for a case [Attorney]");

export async function execute(interaction: CommandInteraction) {
    await interaction.deferReply();

    // Check the permissions of the user.
    let permission = await getPermissionFromDiscordID(interaction.user.id);
    if ((permission & permissions_list.ATTORNEY) == 0 && (permission & permissions_list.ADMINISTRATOR) == 0) {
        return await interaction.editReply({ embeds: [createErrorEmbed("Permission Error", "Must be an attorney to run this command.")] });
    }

    const chatInteraction = interaction as ChatInputCommandInteraction;
    let case_code = chatInteraction.options.getString("case_code", true);
    let party = chatInteraction.options.getString("party", true);

    const processing_embed = new EmbedBuilder()
        .setTitle("Processing")
        .setDescription("Processing your NOA Request!")
        .setColor("#9853b5")
        .setTimestamp();

    try {
        // Check to see if the case_code corresponds to a valid, open case.
        let court_case = await getCaseByCaseCode(case_code);
        if (court_case) {
            if (court_case.status == "closed") {
                return await interaction.editReply({ embeds: [createErrorEmbed("Parameter Error", "Case Code supplied belongs to a case which is closed.")] });
            }
        } else {
            return await interaction.editReply({ embeds: [createErrorEmbed("Parameter Error", "Case Code supplied does not belong to any case in our database.")] });
        }
        
        await interaction.editReply({ embeds: [processing_embed ]});

        // Get relevant information
        let case_type = getCaseTypeFromCaseCode(case_code);
        let jurisdiction;
        if (case_type == "appeal" || case_type == "admin") {
            jurisdiction = "SEVENTH JUDICIAL CIRCUIT COURT";
        } else {
            jurisdiction = "COUNTY COURT";
        }

        let nickname = (await interaction.guild!.members.fetch(interaction.user.id)).nickname;
        let bar_data = await getBarDatabaseDataFromUsername(nickname!);

        processing_embed.setDescription("Processing and uploading your NOA!");
        await interaction.editReply({ embeds: [processing_embed ]});
        
        // File the NOA
        let noa = await createAndStoreNOA({
            case_id: case_code, plaintiffs: court_case.plaintiffs, defendants: court_case.defendants, 
            presiding_judge: court_case.judge, jurisdiction: jurisdiction, username: nickname!, 
            bar_number: bar_data?.bar_number!, party: party.toLowerCase()
        });

        let filing_id = await getUniqueFilingID();
        await insertFiling(filing_id, case_code, party.toLowerCase(), interaction.user.id, ["Notice of Appearance"], [noa]);

        processing_embed.setDescription('Updating the trello with your NOA...');
        await interaction.editReply({ embeds: [processing_embed ]});

        let card = await getCardFromLink(court_case.card_link);
        card.description = updateFilingRecord(card.description, ["Notice of Appearance"], [noa], nickname!);
        await updateTrelloCard(card, case_type);
        
        // Give the user permissions to speak in the channel
        let channel = interaction.guild!.channels.cache.get(court_case.channel)! as GuildChannel;
        channel.permissionOverwrites.edit(interaction.user.id, {
            SendMessages: true,
        });

        await updateRepresentingAttorneysUsingCaseCode(case_code, interaction.user.id, party);

        processing_embed.setDescription(`You should now be able to speak in <#${court_case.channel}>! Thanks for your patience :)`);
        await interaction.editReply({ embeds: [processing_embed ]});
    } catch (error) {
        return await interaction.editReply({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }
}
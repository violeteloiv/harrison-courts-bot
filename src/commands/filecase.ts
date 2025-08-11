import { ActionRowBuilder, ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, Events, 
    MessageFlags, ModalBuilder, SlashCommandBuilder, TextChannel, TextInputBuilder, TextInputStyle } from "discord.js";
import { getCurrentCaseCodes, getFilingByID, getPermissionFromDiscordID, getRobloxIDFromDiscordID, insertCase, insertFiling, updateSpecificCaseCode } from "../database/db_api";
import { permissions_list } from "../config";
import { client } from "../client";
import { generator } from "rand-token";
import { copyAndStoreDocument, createAndStoreNOA, deleteDocuments } from "../document";
import noblox from "noblox.js";
import { copyCaseCardFromTemplate, getTrelloDueDate, updateTrelloCard } from "../database/trello_api";

export const data = new SlashCommandBuilder()
    .setName("filecase")
    .addStringOption(option =>
        option
            .setName("type")
            .setDescription("The type of case which to file (Civil, Criminal, Expungement, Special, Appeal, Admin)")
            .setRequired(true)
    )
    .setDescription("Files a case with the court.");

async function getCodeFromCaseType(case_type: string): Promise<string> {
    let ret = "";

    let current_codes;
    try {
        current_codes = await getCurrentCaseCodes();
    } catch (error) {
        return Promise.reject(error);
    }
    
    const formatter = new Intl.NumberFormat('en', {
        minimumIntegerDigits: 4,
        useGrouping: false,
    });

    if (case_type == "civil") {
        ret += `HCV-${formatter.format(current_codes.civil + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    } else if (case_type == "criminal") {
        ret += `HCM-${formatter.format(current_codes.criminal + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    } else if (case_type == "expungement") {
        ret += `HEX-${formatter.format(current_codes.expungement + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    } else if (case_type == "special") {
        ret += `HSP-${formatter.format(current_codes.special + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    } else if (case_type == "appeal") {
        ret += `HAP-${formatter.format(current_codes.appeal + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    } else if (case_type == "admin") {
        ret += `HAD-${formatter.format(current_codes.admin + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    }

    return Promise.resolve(ret);
}

function generateFilingID(): string {
    return "F-" + generator({ chars: 'base32' }).generate(14);
}

function formatDateUTC(date: Date): string {
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const yy = String(date.getUTCFullYear()).slice(-2);
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const min = String(date.getUTCMinutes()).padStart(2, "0");

    return `${mm}/${dd}/${yy} ${hh}:${min} UTC`;
}

export async function execute(interaction: CommandInteraction) {
    // Get the input data.
    const chatInteraction = interaction as ChatInputCommandInteraction;
    let case_type = chatInteraction.options.getString("type", true).toLowerCase();
    let jurisdiction = "";

    // Ensure the user has the required permissions to run this command.
    if (!interaction.inCachedGuild()) return;
    const roleNames = interaction.member?.roles.cache.map(r => r.name);
    if (!roleNames.includes("Registered")) {
        const embed = new EmbedBuilder()
            .setTitle("Permission Error")
            .setDescription("You must register with /register before running this command.")
            .setColor("#d93a3a")
            .setTimestamp();

        return await interaction.reply({ embeds: [embed] });
    }

    // Get the channel the modal was sent in.
    let channel = interaction.channel;
    if (channel?.isTextBased()) {
        channel = channel as TextChannel;
    } else {
        const embed = new EmbedBuilder()
            .setTitle("Permission Error")
            .setDescription("You must run this command in a discord server.")
            .setColor("#d93a3a")
            .setTimestamp();

        return await interaction.reply({ embeds: [embed] });
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

    if (error_message != "The following must be fixed in your submission:\n") {
        const embed = new EmbedBuilder()
            .setTitle("Case Error")
            .setDescription(error_message)
            .setColor("#d93a3a")
            .setTimestamp();

        return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Create the next page modal.
    const modal = new ModalBuilder()
        .setCustomId(`case_specific_modal-${case_type}-${jurisdiction}-${permission}`)
        .setTitle(`${case_type} Action Information`);

    if (case_type == "civil") {
        const plaintffs_input = new TextInputBuilder()
            .setCustomId("plaintiffs")
            .setLabel("Add the Plaintiffs in a Comma Separated List")
            .setPlaceholder("Plaintiff1, Plaintiff2, ...")
            .setStyle(TextInputStyle.Short);

        const plaintiff_action = new ActionRowBuilder<TextInputBuilder>().addComponents(plaintffs_input);
        modal.addComponents(plaintiff_action);
    }

    if (case_type == "civil" || case_type == "criminal") {
        const defendants_input = new TextInputBuilder()
            .setCustomId("defendants")
            .setLabel("Add the Defendants in a Comma Separated List")
            .setPlaceholder("Defendant1, Defendant2, ...")
            .setStyle(TextInputStyle.Short);

        const defendants_action = new ActionRowBuilder<TextInputBuilder>().addComponents(defendants_input);
        modal.addComponents(defendants_action);
    }

    if (case_type == "expungement" || case_type == "special") {
        const petitioners_input = new TextInputBuilder()
            .setCustomId("petitioners")
            .setLabel("Add the Petitioner")
            .setPlaceholder("Petitioner1, Petitioner2, ...")
            .setStyle(TextInputStyle.Short);

        const petitioners_action = new ActionRowBuilder<TextInputBuilder>().addComponents(petitioners_input);
        modal.addComponents(petitioners_action);
    }

    // TODO: Determine if:
    //  (a) The individual is a party to the case, or an attorney to the party.
    //  (b) The case supplied is a valid case in the database.
    if (case_type == "appeal") {
        const case_code_input = new TextInputBuilder()
            .setCustomId("case_code")
            .setLabel("Supply the Case Code For Appeal")
            .setPlaceholder("HXX-XXXX-YY")
            .setStyle(TextInputStyle.Short);

        const case_code_action = new ActionRowBuilder<TextInputBuilder>().addComponents(case_code_input);
        modal.addComponents(case_code_action);
    }

    // TODO: Figure out how to file an administrative claim??
    if (case_type == "admin") {

    }

    const document_types_input = new TextInputBuilder()
        .setCustomId("document_types")
        .setLabel("Comma Separated List of Document Types")
        .setPlaceholder("Complaint, Information, Affidavit, ...")
        .setStyle(TextInputStyle.Short);

    const document_types_action = new ActionRowBuilder<TextInputBuilder>().addComponents(document_types_input);
    modal.addComponents(document_types_action);

    const documents_input = new TextInputBuilder()
        .setCustomId("documents")
        .setLabel("Comma Separated Docs (GDrive Copyable Links)")
        .setStyle(TextInputStyle.Paragraph);

    const documents_action = new ActionRowBuilder<TextInputBuilder>().addComponents(documents_input);
    modal.addComponents(documents_action);

    await interaction.showModal(modal);
}

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    await interaction.deferReply();

    // Get the data from the unique ID.
    const [_, case_type, jurisdiction, perm] = interaction.customId.split('-');
    let permission = parseInt(perm);

    // Get the plaintiffs (or petitioners) and defendants
    let plaintiffs, defendants;
    let party = "";
    if (interaction.fields.fields.has("plaintiffs")) {
        plaintiffs = interaction.fields.getField("plaintiffs").value.split(",").map(item => item.trim());
        party = "Plaintiff";
    } else if (interaction.fields.fields.has("petitioners")) {
        plaintiffs = interaction.fields.getField("petitioners").value.split(",").map(item => item.trim());
        party = "Petitioner";
    }

    if (interaction.fields.fields.has("defendants")) {
        defendants = interaction.fields.getField("defendants").value.split(",").map(item => item.trim());
    }

    if (case_type == "criminal") {
        plaintiffs = ["The People"];
    } else if (case_type == "expungement" || case_type == "special") {
        defendants = ["The People"];
    }

    // Create the filing for the documents provided.
    const document_types = interaction.fields.getField("document_types").value.split(",").map(item => item.trim());
    const documents = interaction.fields.getField("documents").value.split(",").map(item => item.trim());
    documents.forEach(async (document) => {
        // TODO: Add support for PDF submissions.
        if (document.slice(0, 33) != "https://docs.google.com/document/") {
            const embed = new EmbedBuilder()
                .setTitle("Filing Error")
                .setDescription("One of your documents was not a Google Drive Document Link.")
                .setColor("#d93a3a")
                .setTimestamp();

            return await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    });

    let case_code;
    try {
        case_code = await getCodeFromCaseType(case_type);
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle("Bot Error")
            .setDescription("It appears we were unable to get the case code from your supplied case type. Contact <@344666620419112963> about this error.")
            .setColor("#d93a3a")
            .setTimestamp();

        console.log(error);
        return await interaction.followUp({ embeds: [embed] });
    }
    
    let final_types: string[] = [];
    let final_docs: string[] = [];

    // Determine if the individual is a representing attorney of the petitioner or plaintiff. If so add a NOA filing.
    let roblox_id;
    try {
        roblox_id = await getRobloxIDFromDiscordID(interaction.user.id);
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle("Bot Error")
            .setDescription("It appears we were unable to get your Roblox ID. Contact <@344666620419112963> about this error.")
            .setColor("#d93a3a")
            .setTimestamp();

        console.log(error);
        return await interaction.followUp({ embeds: [embed] });
    }

    let username;
    try {
        username = await noblox.getUsernameFromId(roblox_id);
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle("Bot Error")
            .setDescription("It appears we were unable to get your Roblox Username. Contact <@344666620419112963> about this error.")
            .setColor("#d93a3a")
            .setTimestamp();

        console.log(error);
        return await interaction.followUp({ embeds: [embed] });
    }

    const processing_embed = new EmbedBuilder()
        .setTitle("Processing Your Request")
        .setDescription("We are processing your documents, please be patient :)")
        .setColor("#9853b5")
        .setTimestamp();

    if (permission & permissions_list.ATTORNEY) {
        let link;
        try {
            link = await createAndStoreNOA({
                case_id: case_code,
                plaintiffs: plaintiffs!,
                defendants: defendants!,
                presiding_judge: "TBD",
                username: username,
                jurisdiction: (jurisdiction == "county" ? "COUNTY COURT" : "SEVENTH JUDICIAL CIRCUIT"),
                bar_number: 111000,
                party: party
            });
        } catch (error) {
            const embed = new EmbedBuilder()
            .setTitle("Bot Error")
            .setDescription("It appears we encountered an error when creating your NOA. Contact <@344666620419112963> about this error.")
            .setColor("#d93a3a")
            .setTimestamp();

            console.log(error);
            return await interaction.followUp({ embeds: [embed] });
        }

        final_types.push("Notice of Appearance");
        final_docs.push(link!);

        processing_embed.setDescription("Created your Notice of Appearance!");

        interaction.editReply({ embeds: [processing_embed] });
    }

    // Make copies of the documents and turn them into pdfs, putting *those* links into the database.
    for (let i = 0; i < document_types.length; i++) {
        let link; 
        try {
            link = await copyAndStoreDocument(documents[i], { case_id: case_code, doc_type: document_types[i] });
        } catch (error) {
            const embed = new EmbedBuilder()
            .setTitle("Bot Error")
            .setDescription("It appears we encountered an error when creating your documents. Contact <@344666620419112963> about this error.")
            .setColor("#d93a3a")
            .setTimestamp();

            console.log(error);
            return await interaction.followUp({ embeds: [embed] });
        }
        
        final_types.push(document_types[i]);
        final_docs.push(link!);

        processing_embed.setDescription(`Created your ${document_types[i]}!`);

        interaction.editReply({ embeds: [processing_embed] });
    }

    processing_embed.setDescription("All documents processed! Uploading information to Trello.");
    interaction.editReply({ embeds: [processing_embed] });

    // Create the trello card.
    // TODO: Update to work with appelate cases.
    let case_card;
    try {
        case_card = await copyCaseCardFromTemplate(jurisdiction, case_type, plaintiffs!, defendants!);
    } catch (error) {
        let embed = new EmbedBuilder()
            .setTitle("Bot Error")
            .setDescription("It appears we encountered an error when creating the trello card. Contact <@344666620419112963> about this error.")
            .setColor("#d93a3a")
            .setTimestamp();

        // Delete the documents.
        try {
            await deleteDocuments(final_docs);
        } catch (error) {
            embed = new EmbedBuilder()
                .setTitle("Bot Error")
                .setDescription("It appears we encountered an error when trying to delete your documents after the trello card creation failed. Contact <@344666620419112963> about this error.")
                .setColor("#d93a3a")
                .setTimestamp();
        }

        console.log(error);
        return await interaction.followUp({ embeds: [embed] });
    }
    
    // Fill out the information as needed.
    case_card.deadline = getTrelloDueDate(3);

    const case_card_header = `**Presiding Judge:** TBD\n**Date Assigned:** TBD\n**Docket #:** ${case_code}\n\n---\n\n**Record:**\n`;

    let new_description = case_card_header;
    for (let i = 0; i < final_types.length; i++) {
        new_description += `${formatDateUTC(new Date())} | [${final_types[i]}](${final_docs[i]}) - Filed By: ${username}\n`
    }
    case_card.description = new_description;

    try {
        await updateTrelloCard(case_card, case_type);
    } catch (error) {
        let embed = new EmbedBuilder()
            .setTitle("Bot Error")
            .setDescription("It appears we encountered an error when editing the trello card. Contact <@344666620419112963> about this error.")
            .setColor("#d93a3a")
            .setTimestamp();

        // Delete the documents.
        try {
            await deleteDocuments(final_docs);
        } catch (error) {
            embed = new EmbedBuilder()
                .setTitle("Bot Error")
                .setDescription("It appears we encountered an error when trying to delete your documents after the trello card editing failed. Contact <@344666620419112963> about this error.")
                .setColor("#d93a3a")
                .setTimestamp();
        }

        console.log(error);
        return await interaction.followUp({ embeds: [embed] });
    }

    processing_embed.setDescription(`Information uploaded to [trello](${case_card.url}).`);
    interaction.editReply({ embeds: [processing_embed] });

    // Update the case code database
    try {
        let current_codes = await getCurrentCaseCodes();
        await updateSpecificCaseCode(case_type.toLowerCase(), current_codes[case_type.toLowerCase()] + 1);  
    } catch (error) {
        let embed = new EmbedBuilder()
            .setTitle("Bot Error")
            .setDescription("It appears we encountered an error when uploading to the case codes database. Contact <@344666620419112963> about this error.")
            .setColor("#d93a3a")
            .setTimestamp();

        // Delete the documents.
        try {
            await deleteDocuments(final_docs);
        } catch (error) {
            embed = new EmbedBuilder()
                .setTitle("Bot Error")
                .setDescription("It appears we encountered an error when trying to delete your documents after the database update occured. Contact <@344666620419112963> about this error.")
                .setColor("#d93a3a")
                .setTimestamp();
        }
        
        console.log(error);
        return await interaction.followUp({ embeds: [embed] });
    }

    // Update the filing database
    let filing_id = generateFilingID();
    while (await getFilingByID(filing_id)) {
        filing_id = generateFilingID();
    }

    try {
        await insertFiling(filing_id, case_code, party, interaction.user.id, final_types, final_docs);
    } catch (error) {
        let embed = new EmbedBuilder()
            .setTitle("Bot Error")
            .setDescription("It appears we encountered an error when uploading to the filing database. Contact <@344666620419112963> about this error.")
            .setColor("#d93a3a")
            .setTimestamp();

        // Delete the documents.
        try {
            await deleteDocuments(final_docs);
        } catch (error) {
            embed = new EmbedBuilder()
                .setTitle("Bot Error")
                .setDescription("It appears we encountered an error when trying to delete your documents after the database update occured. Contact <@344666620419112963> about this error.")
                .setColor("#d93a3a")
                .setTimestamp();
        }
        
        console.log(error);
        return await interaction.followUp({ embeds: [embed] });
    }

    // Update the case database
    let rep_attorneys = [];
    if ((permission & permissions_list.ATTORNEY) > 0) {
        rep_attorneys.push(interaction.user.id);
    }

    try {
        await insertCase(case_code, "", case_card.url, "", "pending", false, [], [], rep_attorneys, [], [filing_id]);
    } catch (error) {
        let embed = new EmbedBuilder()
            .setTitle("Bot Error")
            .setDescription("It appears we encountered an error when uploading to the filing database. Contact <@344666620419112963> about this error.")
            .setColor("#d93a3a")
            .setTimestamp();

        // Delete the documents.
        try {
            await deleteDocuments(final_docs);
        } catch (error) {
            embed = new EmbedBuilder()
                .setTitle("Bot Error")
                .setDescription("It appears we encountered an error when trying to delete your documents after the database update occured. Contact <@344666620419112963> about this error.")
                .setColor("#d93a3a")
                .setTimestamp();
        }
        
        console.log(error);
        return await interaction.followUp({ embeds: [embed] });
    }

    processing_embed.setDescription(`Information uploaded to [trello](${case_card.url})! You're all set :)`);
    return interaction.editReply({ embeds: [processing_embed] });
});
import { EmbedBuilder, Message } from "discord.js";
import { Answer, Form } from "../helper/form";
import { capitalizeEachWord, createErrorEmbed, formatDateUTC, generateFilingID, getCodeFromCaseType } from "../helper/format";
import { permissions_list } from "../config";
import { getCurrentCaseCodes, getFilingByID, getRobloxIDFromDiscordID, insertCase, insertFiling, updateSpecificCaseCode } from "../api/db_api";
import noblox from "noblox.js";
import { copyAndStoreDocument, uploadAndStorePDF } from "../api/doc_api";
import { copyCaseCardFromTemplate, getTrelloDueDate, updateTrelloCard } from "../api/trello_api";
import { createAndStoreNOA } from "../api/documents/noa";

export interface CivilCaseInfo {
    permission: number,
    id: string,
    message: Message,
}

export function createCivilFilingForm(): Form {
    let form: Form = { questions: [] };

    form.questions.push({
        question: "Please respond with a list of plaintiffs in a comma separated list.",
        callback: (message: Message, responses: any[]) => {
            if (message.content == "") return { name: "invalid", value: createErrorEmbed("Form Error", "You must have plaintiffs to file a civil action.") };

            let plaintiffs: string[] = message.content.split(",").map(item => item.trim());
            return { name: "plaintiffs", value: plaintiffs };
        }
    });

    form.questions.push({
        question: "Please respond with a list of defendants in a comma separated list.",
        callback: (message: Message, responses: any[]) => {
            if (message.content == "") return { name: "error", value: createErrorEmbed("Form Error", "You must have defendants to file a civil action.") };

            let defendants: string[] = message.content.split(",").map(item => item.trim());
            return { name: "defendants", value: defendants };
        }
    });

    let doc_types_question = "Add a comma separated list of document types. The following are possible options:\n"
    doc_types_question += "- Complaint\n";
    doc_types_question += "- Affidavit\n";
    doc_types_question += "- Demand\n";
    doc_types_question += "- Notice\n";
    doc_types_question += "If you do not wish to file any documents initially, type 'N/A'";
    
    form.questions.push({
        question: doc_types_question,
        callback: (message: Message, responses: any[]) => {
            let msg = message.content.toLowerCase();

            if (msg == "n/a") {
                return { name: "skip", value: "" };
            } else {
                let doc_types = msg.split(",").map(item => item.trim());
                for (let i = 0; i < doc_types.length; i++) {
                    if (doc_types[i] != "complaint"  && doc_types[i] != "affidavit" && doc_types[i] != "demand" && doc_types[i] != "notice") {
                        return { name: "error", value: createErrorEmbed("Form Error", "You can only file one of the above documents when initiating a civil action.") };
                    }
                }

                return { name: "doc_types", value: doc_types };
            }
        }
    });

    let documents_question = "You have two options for filing your documents:\n";
    documents_question += "- (1) Add a comma separated list of google document links.\n"
    documents_question += "- (2) Attach your documents as PDFs.";

    form.questions.push({
        question: documents_question,
        callback: (message: Message, responses: any[]) => {
            // Supply no documents if doc_types is empty.
            if (responses.find(val => val.name == "doc_types").length == 0) {
                return { name: "gdrive_docs", value: [] };
            }

            // Return a list of pdf documents, otherwise a list of links to gdrive links.
            if (message.attachments.size > 0) {
                const pdf_attachments = message.attachments
                    .filter(att => att.name?.toLowerCase().endsWith(".pdf"))
                    .map(att => att);

                if (pdf_attachments.length != message.attachments.size) {
                    return { name: "error", value: createErrorEmbed("Form Error", "Ensure you only submit PDFs.") };
                }

                if (pdf_attachments.length != responses.find(val => val.name == "doc_types").value.length) {
                    return { name: "error", value: createErrorEmbed("Form Error", "Ensure you submit the same number of documents as document types you specified.") };
                }

                return { name: "pdf_att", value: pdf_attachments };
            } else {
                let docs = message.content.split(",").map(item => item.trim());
                for (let i = 0; i < docs.length; i++) {
                    if (docs[i].match("/https:\/\/docs\.google\.com\/document\/d\/(.*?)\/.*?\?usp=sharing/")) 
                        return { name: "error", value: createErrorEmbed("Form Error", "If submitting links, you can only submit Google Document Links") };
                }

                return { name: "gdrive_docs", value: docs };
            }
        }
    });

    return form;
}

export async function processCivilFilingForm(info: CivilCaseInfo, responses: any[]) {
    let plaintiffs = responses.find(val => val.name == "plaintiffs").value;
    let defendants = responses.find(val => val.name == "defendants").value;
    let doc_types_raw = responses.find(val => val.name == "doc_types");

    try {
        // Get identifying information.
        let case_code = await getCodeFromCaseType("civil");
        let roblox_id = await getRobloxIDFromDiscordID(info.id);
        let username = await noblox.getUsernameFromId(roblox_id);
        let rep_attorneys = [];

        let processed_docs: string[] = [];
        let processed_doc_types: string[] = [];

        const embed = new EmbedBuilder()
            .setTitle("Form Conclusion")
            .setColor("#9853b5")
            .setTimestamp();

        // Add an NOA to the filing if they are an attorney.
        if ((info.permission & permissions_list.ATTORNEY) > 0) {
            embed.setDescription("Uploading your Notice of Appearance...");
            info.message.edit({ embeds: [embed] });

            processed_docs.push(await createAndStoreNOA({
                case_id: case_code,
                plaintiffs: plaintiffs,
                defendants: defendants,
                presiding_judge: "TBD",
                username: username,
                jurisdiction: "COUNTY COURT",
                bar_number: 111000,
                party: "Plaintiff",
            }));
            processed_doc_types.push("Notice of Appearance");

            rep_attorneys.push(info.id);
        }

        if (doc_types_raw) {
            let doc_types = doc_types_raw.value;
            
            // Process the supplied documents!
            let pdf_docs_response: Answer = responses.find(val => val.name == "pdf_att");
            let gdrive_docs_response: Answer = responses.find(val => val.name == "gdrive_docs");
            
            if (gdrive_docs_response) {
                let gdrive_docs = gdrive_docs_response.value;
                for (let i = 0; i < gdrive_docs.length; i++) {
                    let doc_type = capitalizeEachWord(doc_types[i]);
                    embed.setDescription(`Uploading your ${doc_type}...`);
                    info.message.edit({ embeds: [embed] });

                    processed_docs.push(await copyAndStoreDocument(gdrive_docs[i], {
                        case_id: case_code, doc_type: doc_type
                    }));
                    processed_doc_types.push(doc_type);
                }
            } else {
                let pdf_att = pdf_docs_response.value;
                for (let i = 0; i < pdf_att.length; i++) {
                    let doc_type = capitalizeEachWord(doc_types[i]);
                    embed.setDescription(`Uploading your ${doc_type}...`);
                    info.message.edit({ embeds: [embed] });

                    processed_docs.push(await uploadAndStorePDF(pdf_att[i], {
                        case_id: case_code, doc_type: doc_type
                    }));
                    processed_doc_types.push(doc_type);
                }
            }
        }

        embed.setDescription(`Done uploading your documents, now storing on trello...`);
        info.message.edit({ embeds: [embed] });

        // Upload to trello.
        let case_card = await copyCaseCardFromTemplate("county", "civil", plaintiffs, defendants);
        case_card.deadline = getTrelloDueDate(3);

        const case_card_header = `**Presiding Judge:** TBD\n**Date Assigned:** TBD\n**Docket #:** ${case_code}\n\n---\n\n**Record:**\n`;
        let new_description = case_card_header;
        for (let i = 0; i < processed_doc_types.length; i++) {
            new_description += `${formatDateUTC(new Date())} | [${processed_doc_types[i]}](${processed_docs[i]}) - Filed By: ${username}\n`
        }
        case_card.description = new_description;

        case_card.labels = [
            { id: "6897f0d8fb4520a9e3064806", name: "PENDING" },
            { id: "6897f11ed92e87ddd328ed1b", name: "CIVIL" },
        ]

        await updateTrelloCard(case_card, "civil");

        embed.setDescription(`Information uploaded to trello! Find it [here](${case_card.url}).`);
        info.message.edit({ embeds: [embed] });

        // Update the relevant databases.
        let current_codes = await getCurrentCaseCodes();
        await updateSpecificCaseCode("civil", current_codes["civil"] + 1);  

        let filing_id = generateFilingID();
        while (await getFilingByID(filing_id)) {
            filing_id = generateFilingID();
        }

        if (processed_doc_types.length != 0) {
            await insertFiling(filing_id, case_code, "Plaintiff", info.id, processed_doc_types, processed_docs);
            await insertCase(case_code, "", case_card.url, "", "pending", false, plaintiffs, defendants, rep_attorneys, [], [filing_id]);
        } else {
            await insertCase(case_code, "", case_card.url, "", "pending", false, plaintiffs, defendants, rep_attorneys, [], []);
        }

        embed.setDescription(`Information uploaded to trello! Find it [here](${case_card.url}). You're all set :)`);
        info.message.edit({ embeds: [embed] });
    } catch (error) {
        const embed = createErrorEmbed(
            "Internal Bot Error",
            `There has been an internal bot error, please contact <@344666620419112963> with the following error message:\n${error}`
        )
        
        info.message.edit({ embeds: [embed] });
    }
}
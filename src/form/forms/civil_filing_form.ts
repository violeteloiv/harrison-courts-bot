import { EmbedBuilder, Message } from "discord.js";
import noblox from "noblox.js";

import { CaseCodesRepository } from "../../api/db/repos/case_codes";
import { CaseRole, CasesRepository } from "../../api/db/repos/cases";
import { DatabaseClient } from "../../api/db/client";
import { FilingRepository } from "../../api/db/repos/filings";
import { UsersRepository } from "../../api/db/repos/users";
import { create_error_embed } from "../../api/discord/visual";
import { copy_and_store } from "../../api/google/doc";
import { create_and_store_noa } from "../../api/google/documents";
import { buffer_to_stream, download_file, format_date_utc } from "../../api/file";
import { permissions_list } from "../../api/permissions";
import { update_card } from "../../api/trello/card";
import { copy_case_card, get_trello_due_date } from "../../api/trello/service";

import { Answer, Form } from "../form";
import { capitalize_each_word, get_code_from_case_type, get_unique_filing_id } from "../../helper/format";
import { get_id_from_user } from "../../api/discord/user";

import { BOT_SUCCESS_COLOR, COURTS_SERVER_ID } from "../../config";
import { get_destination_folder, get_drive_client, upload_pdf, upload_stream_to_drive } from "../../api/google/drive";
import { format_error_info } from "../../api/error";
import { get_bar_data } from "../../api/google/sheets";

export interface CivilCaseInfo {
    permission: number,
    id: string,
    message: Message,
}

const db = new DatabaseClient();
const users_repo = new UsersRepository(db);
const case_codes_repo = new CaseCodesRepository(db);
const filings_repo = new FilingRepository(db);
const cases_repo = new CasesRepository(db);

/**
 * Creates a filing form for a civil case.
 * 
 * @returns The form for the civil case processing.
 */
export function create_civil_filing_form(): Form {
    let form: Form = { questions: [] };

    form.questions.push({
        prompt: "Please respond with a list of plaintiffs as a command separated list of roblox usernames.",
        handle: (message: Message, responses: Answer[]) => {
            if (message.content == "")
                return { type: "retry", error_embed: create_error_embed("Form Error", "You must have plaintiffs to file a civil action.") };

            let plaintiffs: string[] = message.content.split(",").map(item => item.trim());
            return { type: "answer", answer: { name: "plaintiffs", value: plaintiffs } };
        }
    });

    form.questions.push({
        prompt: "Please respond with a list of defendants as a command separated list of roblox usernames.",
        handle: (message: Message, responses: any[]) => {
            if (message.content == "") return { type: "retry", error_embed: create_error_embed("Form Error", "You must have defendants to file a civil action.") };

            let defendants: string[] = message.content.split(",").map(item => item.trim());
            return { type: "answer", answer: { name: "defendants", value: defendants } };
        }
    });

    let doc_types_question = "Add a comma separated list of document types. The following are possible options:\n"
    doc_types_question += "- Complaint\n";
    doc_types_question += "- Affidavit\n";
    doc_types_question += "- Demand\n";
    doc_types_question += "- Notice\n";
    doc_types_question += "If you do not wish to file any documents initially, type 'N/A'";
    
    form.questions.push({
        prompt: doc_types_question,
        handle: (message: Message, responses: any[]) => {
            let msg = message.content.toLowerCase();

            if (msg == "n/a") {
                return { type: "skip", skipBy: 2 };
            } else {
                let doc_types = msg.split(",").map(item => item.trim());
                for (let i = 0; i < doc_types.length; i++)
                    if (doc_types[i] != "complaint"  && doc_types[i] != "affidavit" && doc_types[i] != "demand" && doc_types[i] != "notice")
                        return { type: "retry", error_embed: create_error_embed("Form Error", "You can only file one of the above documents when initiating a civil action.") };

                return { type: "answer", answer: { name: "doc_types", value: doc_types } };
            }
        }
    });

    let documents_question = "You have two options for filing your documents:\n";
    documents_question += "- (1) Add a comma separated list of google document links.\n"
    documents_question += "- (2) Attach your documents as PDFs.";

    form.questions.push({
        prompt: documents_question,
        handle: (message: Message, responses: any[]) => {
            // Supply no documents if doc_types is empty.
            if (responses.find(val => val.name == "doc_types").length == 0)
                return { type: "answer", answer: { name: "gdrive_docs", value: [] } };

            // Return a list of pdf documents, otherwise a list of links to gdrive links.
            if (message.attachments.size > 0) {
                const pdf_attachments = message.attachments
                    .filter(att => att.name?.toLowerCase().endsWith(".pdf"))
                    .map(att => att);

                if (pdf_attachments.length != message.attachments.size)
                    return { type: "retry", error_embed: create_error_embed("Form Error", "Ensure you only submit PDFs.") };

                if (pdf_attachments.length != responses.find(val => val.name == "doc_types").value.length)
                    return { type: "retry", error_embed: create_error_embed("Form Error", "Ensure you submit the same number of documents as document types you specified.") };

                return { type: "answer", answer: { name: "pdf_att", value: pdf_attachments } };
            } else {
                let docs = message.content.split(",").map(item => item.trim());
                for (let i = 0; i < docs.length; i++)
                    if (docs[i].match(/https:\/\/docs\.google\.com\/document\/d\/(.*?)\/.*?\?usp=sharing/)) 
                        return { type: "retry", error_embed: create_error_embed("Form Error", "If submitting links, you can only submit Google Document Links") };

                return { type: "answer", answer: { name: "gdrive_docs", value: docs } };
            }
        }
    });

    return form;
}

/**
 * Processes the data received from the civil filing form.
 * 
 * @param info The information received
 * @param responses The responses received
 */
export async function process_civil_filing_form(info: CivilCaseInfo, responses: Answer[]) {
    let plaintiffs = responses.find(val => val.name == "plaintiffs")!.value as string[];
    let defendants = responses.find(val => val.name == "defendants")!.value as string[];
    let doc_types = responses.find(val => val.name == "doc_types")!.value as string[];

    try {
        let user = await users_repo.get_by_id(info.id);

        // Get identifying information.
        let case_code = await get_code_from_case_type("civil");
        let roblox_id = Number(user!.roblox_id);
        let username = await noblox.getUsernameFromId(roblox_id);

        let processed_docs: { doc_link: string }[] = [];
        let processed_doc_types: { type: string }[] = [];

        const embed = new EmbedBuilder()
            .setTitle("Form Conclusion")
            .setColor(BOT_SUCCESS_COLOR)
            .setTimestamp();

        let parties = [];
        console.log("Plaintiffs: " + plaintiffs);
        console.log("Defendants: " + defendants);

        for (const plaintiff of plaintiffs) {
            let id = await noblox.getIdFromUsername(plaintiff);

            let user = await users_repo.get_by_id(id);
            if (!user) {
                await info.message.edit({
                    embeds: [create_error_embed(
                        "Information Error",
                        "The plaintiffs must be registered in the courts discord server before filing."
                    )]
                });
                return;
            }

            parties.push({ user_id: String(id), role: "plaintiff" as CaseRole });
        }

        for (const defendant of defendants) {
            let id = await get_id_from_user(defendant, COURTS_SERVER_ID);

            let user = await users_repo.get_by_id(id);

            if (user) {
                parties.push({
                    user_id: String(id), 
                    role: "defendant" as CaseRole
                });
            } else {
                const def_roblox_id = await noblox.getIdFromUsername(defendant);

                await users_repo.upsert({
                    discord_id: "0",
                    roblox_id: String(def_roblox_id),
                    permission: 0
                });
                parties.push({
                    user_id: String(def_roblox_id),
                    role: "defendant" as CaseRole
                });
            }
        }

        // Add an NOA to the filing if they are an attorney.
        if ((info.permission & permissions_list.ATTORNEY) > 0) {
            embed.setDescription("Uploading your Notice of Appearance...");
            info.message.edit({ embeds: [embed] });

            const bar_data = await get_bar_data(username);
            if (!bar_data) return await info.message.edit({ embeds: [create_error_embed("Bar Data Error", "Your data is not listed in the Bar Database.")] });

            processed_docs.push({ doc_link: await create_and_store_noa({
                case_id: case_code,
                plaintiffs: plaintiffs,
                defendants: defendants,
                presiding_judge: "TBD",
                username: username,
                jurisdiction: "COUNTY COURT",
                bar_number: bar_data.bar_number,
                party: "Plaintiff",
            })});
            processed_doc_types.push({ type: "Notice of Appearance" });

            parties.push({ user_id: user?.roblox_id!, role: "p_counsel" as CaseRole });
        }

        if (doc_types) {
            // Process the supplied documents!
            let pdf_docs_response: Answer = responses.find(val => val.name == "pdf_att")!;
            let gdrive_docs_response: Answer = responses.find(val => val.name == "gdrive_docs")!;
            
            if (gdrive_docs_response) {
                let gdrive_docs = gdrive_docs_response.value;
                for (let i = 0; i < gdrive_docs.length; i++) {
                    let doc_type = capitalize_each_word(doc_types[i]);
                    embed.setDescription(`Uploading your ${doc_type}...`);
                    info.message.edit({ embeds: [embed] });

                    processed_docs.push({ doc_link: await copy_and_store(gdrive_docs[i].url, {
                        case_code: case_code, doc_type: doc_type
                    })});
                    processed_doc_types.push({ type: doc_type });
                }
            } else {
                let pdf_att = pdf_docs_response.value;
                for (let i = 0; i < pdf_att.length; i++) {
                    let doc_type = capitalize_each_word(doc_types[i]);
                    embed.setDescription(`Uploading your ${doc_type}...`);
                    info.message.edit({ embeds: [embed] });

                    const buffer = await download_file(pdf_att[i].url);
                    const stream = buffer_to_stream(buffer);
                    const file = await upload_stream_to_drive(stream, `${pdf_att[i].name} - ${format_date_utc(new Date())}`, get_destination_folder(), "application/pdf");

                    processed_docs.push({ doc_link: file.webViewLink! });
                    processed_doc_types.push({ type: doc_type });
                }
            }
        }

        embed.setDescription(`Done uploading your documents, now storing on trello...`);
        info.message.edit({ embeds: [embed] });

        // Upload to trello.
        let case_card = await copy_case_card("county", "civil", plaintiffs, defendants);
        case_card.deadline = get_trello_due_date(3);

        const case_card_header = `**Presiding Judge:** TBD\n**Date Assigned:** TBD\n**Docket #:** ${case_code}\n\n---\n\n**Record:**\n`;
        let new_description = case_card_header;
        for (let i = 0; i < processed_doc_types.length; i++) {
            new_description += `${format_date_utc(new Date())} | [${processed_doc_types[i].type}](${processed_docs[i].doc_link}) - Filed By: ${username}\n`
        }
        case_card.description = new_description;

        // TODO: Replace with constants
        case_card.labels = [
            { id: "6897f0d8fb4520a9e3064806", name: "PENDING" },
            { id: "6897f11ed92e87ddd328ed1b", name: "CIVIL" },
        ]

        await update_card(case_card);

        embed.setDescription(`Information uploaded to trello! Find it [here](${case_card.url}).`);
        info.message.edit({ embeds: [embed] });

        // Update the relevant databases.
        await case_codes_repo.increment_code("civil");

        let filing_id = await get_unique_filing_id();

        if (processed_doc_types.length != 0) {
            await cases_repo.upsert({ case_code: case_code, judge: "", card_link: case_card.url, channel: "", status: "pending", parties: parties });
            await filings_repo.upsert({ filing_id: filing_id, case_code: case_code, party: "Plaintiff", filed_by: user?.roblox_id!,  types: processed_doc_types, documents: processed_docs });
        } else {
            await cases_repo.upsert({ case_code: case_code, judge: "", card_link: case_card.url, channel: "", status: "pending", parties: parties });
        }

        embed.setDescription(`Information uploaded to trello! Find it [here](${case_card.url}). You're all set :)`);
        info.message.edit({ embeds: [embed] });
    } catch (error) {
        const embed = create_error_embed(
            "Internal Bot Error",
            `There has been an internal bot error, please contact <@344666620419112963> with the following error message:\n${format_error_info(error as Error)}`
        )
        info.message.edit({ embeds: [embed] });
    }
}
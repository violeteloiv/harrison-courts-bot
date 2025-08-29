import { Attachment, EmbedBuilder, Message } from "discord.js";
import { Form } from "../helper/form";
import { createErrorEmbed, formatDateUTC, generateFilingID, getCodeFromCaseType, longMonthDayYearFormat } from "../helper/format";
import { copyCaseCardFromTemplate, getTrelloDueDate, updateTrelloCard } from "../api/trello_api";
import { uploadAndStorePDF } from "../api/doc_api";
import { getCurrentCaseCodes, getFilingByID, insertCase, insertFiling, updateSpecificCaseCode } from "../api/db_api";

export interface TransferPetitionInfo {
    message: Message,
    username: string,
    id: string,
}

export function createTransferPetitionForm(): Form {
    let form: Form = { questions: [] };

    let question = "Fill out the following [form](https://trello.com/c/Rk3LJzrs/7-petition-for-admission-to-the-bar-transfer) and upload it here as an attachment.\n";
    question += "---\n";
    question += "**NOTE:** There are two classifications of transfers!\n";
    question += "- **CLASS I:** A transfer from one of the following states:\n"
    question += "  - State of Mayflower (Original)\n";
    question += "  - State of Ridgeway (Original)\n";
    question += "- **CLASS II:** A transfer from one of the following states:\n"
    question += "  - State of Mayflower (V2)\n";
    question += "  - State of Ridgeway (Remade)\n";
    question += "  - State of Firestone\n";
    question += "If at least *one* of your transfers is of CLASS I, you do not have to take the written aptitude assessment. Otherwise, you must submit said assessment results in the next question."

    form.questions.push({
        question: question,
        callback: (message: Message, responses: any[]) => {
            const pdf_attachments = message.attachments
                .filter(att => att.name?.toLowerCase().endsWith(".pdf"))
                .map(att => att);
            
            if (pdf_attachments.length != 1)
                return { name: "error", value: createErrorEmbed("Form Error", "Please ensure you only attach a singular PDF.") };

            return { name: "petition", value: pdf_attachments[0] };
        }
    });

    form.questions.push({
        question: "Submit the pdf you were given upon passing the written aptitude assessment. If you do not have to, write N/A",
        callback: (message: Message, responses: any[]) => {
            const msg = message.content.toLowerCase();

            const pdf_attachments = message.attachments
                .filter(att => att.name?.toLowerCase().endsWith(".pdf"))
                .map(att => att);

            if (msg == 'n/a')
                return { name: "none", value: "" };
            
            if (pdf_attachments.length != 1)
                return { name: "error", value: createErrorEmbed("Form Error", "Please ensure you only attach a singular PDF.") };

            return { name: "certificate", value: pdf_attachments[0] };
        }
    });

    return form;
}

export async function processTransferPetitionForm(info: TransferPetitionInfo, responses: any[]) {
    let processed_doc_types: string[] = [];
    let processed_docs: string[] = [];

    let petition: Attachment = responses.find(val => val.name == "petition").value;
    let certificate_raw = responses.find(val => val.name == "certificate");

    const embed = new EmbedBuilder()
        .setTitle("Form Conclusion")
        .setColor("#9853b5")
        .setTimestamp();
    
    try {
        let case_code = await getCodeFromCaseType("admin");

        embed.setDescription(`Uploading your Petition...`);
        info.message.edit({ embeds: [embed] });
        processed_doc_types.push("Petition");
        processed_docs.push(await uploadAndStorePDF(petition, { case_id: case_code, doc_type: "Petition" }));

        if (certificate_raw) {
            embed.setDescription(`Uploading your Certificate...`);
            info.message.edit({ embeds: [embed] })

            let certificate: Attachment = certificate_raw.value;
            processed_doc_types.push("Certificate");
            processed_docs.push(await uploadAndStorePDF(certificate, { case_id: case_code, doc_type: "Certificate" }));
        }

        embed.setDescription(`Done uploading your documents, now storing on trello...`);
        info.message.edit({ embeds: [embed] });

        let case_card = await copyCaseCardFromTemplate("circuit", "admin", [], []);
        case_card.deadline = getTrelloDueDate(3);

        const case_card_header = `**Date Accepted:** ${longMonthDayYearFormat(new Date())}\n**Docket #:** ${case_code}\n\n---\n\n**Record:**\n`;

        let new_description = case_card_header;
        for (let i = 0; i < processed_doc_types.length; i++) {
            new_description += `${formatDateUTC(new Date())} | [${processed_doc_types[i]}](${processed_docs[i]}) - Filed By: ${info.username}\n`
        }
        case_card.description = new_description;
        
        case_card.name = `Petition for Certification Transfer for ${info.username}`;

        case_card.labels = [
            { id: "6892a4c496df6092610ed6d1", name: "PENDING" },
            { id: "6892a4c496df6092610ed6d5", name: "ADMIN" },
        ]

        await updateTrelloCard(case_card, "admin");

        embed.setDescription(`Information uploaded to trello! Find it [here](${case_card.url}).`);
        info.message.edit({ embeds: [embed] });

        // Update the relevant databases.
        let current_codes = await getCurrentCaseCodes();
        await updateSpecificCaseCode("admin", current_codes["admin"] + 1);  

        let filing_id = generateFilingID();
        while (await getFilingByID(filing_id)) {
            filing_id = generateFilingID();
        }

        await insertFiling(filing_id, case_code, "Petitioner", info.id, processed_doc_types, processed_docs);
        await insertCase(case_code, "", case_card.url, "", "pending", false, [], [], [], [], [filing_id]);

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
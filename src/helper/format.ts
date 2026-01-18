import { generator } from "rand-token";
import { DatabaseClient } from "../api/db/client";
import { CaseCodesRepository } from "../api/db/repos/case_codes";
import { CommandInteraction, ModalSubmitInteraction } from "discord.js";
import { FilingRepository } from "../api/db/repos/filings";
import { create_error_embed } from "../api/discord/visual";
import { format_data_utc } from "../api/file";

export async function getCodeFromCaseType(case_type: string): Promise<string> {
    let ret = "";

    let current_codes;
    try {
        const codes_repo = new CaseCodesRepository(new DatabaseClient());
        current_codes = await codes_repo.get();
    } catch (error) {
        return Promise.reject(error);
    }
    
    const formatter = new Intl.NumberFormat('en', {
        minimumIntegerDigits: 4,
        useGrouping: false,
    });

    if (case_type == "civil") {
        ret += `HCV-${formatter.format(current_codes!.civil + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    } else if (case_type == "criminal") {
        ret += `HCM-${formatter.format(current_codes!.criminal + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    } else if (case_type == "limited") {
        ret += `HSP-${formatter.format(current_codes!.limited + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    } else if (case_type == "admin") {
        ret += `HAD-${formatter.format(current_codes!.admin + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    }

    return Promise.resolve(ret);
}

export function getCaseTypeFromCaseCode(case_code: string): string {
    let id = case_code.slice(1, 3);
    if (id == "CV") return "civil";
    if (id == "CM") return "criminal";
    if (id == "EX") return "expungement";
    if (id == "SP") return "special";
    if (id == "AP") return "appeal";
    if (id == "AD") return "admin";

    throw new Error("Invalid case_code");
}

export function generateFilingID(): string {
    return "F-" + generator({ chars: 'base32' }).generate(14);
}

export function longMonthDayYearFormat(date: Date): string {
    return `${date.toLocaleString("en-US", { month: "long" })} ${date.getDate()}, ${date.getFullYear()}`;
}

export async function botErrorEditReply(interaction: CommandInteraction | ModalSubmitInteraction, title: string, description: string, ephermeral: boolean = false) {
    return await interaction.editReply({ embeds: [create_error_embed(title, description)] });
}

export async function botErrorFollowUp(interaction: CommandInteraction | ModalSubmitInteraction, title: string, description: string, ephermeral: boolean = false) {
    return await interaction.followUp({ embeds: [create_error_embed(title, description)], ephemeral: ephermeral });
}

export function capitalizeEachWord(inputString: string): string {
    if (!inputString) {
        return "";
    }

    return inputString.split(' ').map(word => {
        if (word.length === 0) {
            return "";
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export async function getUniqueFilingID(): Promise<string> {
    const filing_repo = new FilingRepository(new DatabaseClient());
    let filing_id = generateFilingID();
    while (await filing_repo.get_by_id(filing_id)) {
        filing_id = generateFilingID();
    }
    return filing_id;
}

export function updateFilingRecord(desc: string, doc_types: string[], doc_links: string[], filed_by: string): string {
    if (doc_types.length != doc_links.length) throw new Error("doc_types and doc_links do not have the same length");

    let new_desc = desc;
    for (let i = 0; i < doc_types.length; i++) {
        new_desc += `${format_data_utc(new Date())} | [${doc_types[i]}](${doc_links[i]}) - Filed By: ${filed_by}\n`;
    }

    return new_desc;
}
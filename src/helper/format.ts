import { generator } from "rand-token";
import { getCurrentCaseCodes } from "../api/db_api";
import { CommandInteraction, EmbedBuilder, ModalSubmitInteraction } from "discord.js";
import { permissions_list } from "../config";

export async function getCodeFromCaseType(case_type: string): Promise<string> {
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

export function formatDateUTC(date: Date): string {
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const yy = String(date.getUTCFullYear()).slice(-2);
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const min = String(date.getUTCMinutes()).padStart(2, "0");

    return `${mm}/${dd}/${yy} ${hh}:${min} UTC`;
}

export function longMonthDayYearFormat(date: Date): string {
    return `${date.toLocaleString("en-US", { month: "long" })} ${date.getDate()}, ${date.getFullYear()}`;
}

export function createErrorEmbed(title: string, description: string) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor("#d93a3a")
        .setTimestamp();
}

export async function botErrorEditReply(interaction: CommandInteraction | ModalSubmitInteraction, title: string, description: string, ephermeral: boolean = false) {
    return await interaction.editReply({ embeds: [createErrorEmbed(title, description)] });
}

export async function botErrorFollowUp(interaction: CommandInteraction | ModalSubmitInteraction, title: string, description: string, ephermeral: boolean = false) {
    return await interaction.followUp({ embeds: [createErrorEmbed(title, description)], ephemeral: ephermeral });
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

export function getPermissionString(perm: number): string {
    let str = "- **Permissions:**";
    if ((perm & permissions_list.RESIDENT) > 0) {
        str += " `Resident`,";
    }

    if ((perm & permissions_list.PROSECUTOR) > 0) {
        str += " `Prosecutor`,";
    } else if ((perm & permissions_list.ATTORNEY) > 0) {
        str += " `Attorney`,";
    }

    if ((perm & permissions_list.JUDGE) > 0) {
        str += " `Judge`,";
    }

    if ((perm & permissions_list.CLERK) > 0) {
        str += " `Clerk`,";
    }

    if ((perm & permissions_list.ADMINISTRATOR) > 0) {
        str += " `Admin`,";
    }

    if (perm == 0) {
        str += " `None`,";
    }

    str = str.slice(0, -1);

    return str;
}
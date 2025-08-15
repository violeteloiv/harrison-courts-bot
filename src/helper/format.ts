import { generator } from "rand-token";
import { getCurrentCaseCodes } from "../database/db_api";
import { CommandInteraction, EmbedBuilder, ModalSubmitInteraction } from "discord.js";

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
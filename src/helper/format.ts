import { generator } from "rand-token";
import { DatabaseClient } from "../api/db/client";
import { CaseCodesRepository } from "../api/db/repos/case_codes";
import { FilingRepository } from "../api/db/repos/filings";
import { format_date_utc } from "../api/file";
import { Case } from "../api/db/repos/cases";

/**
 * Formats the case code given a case type.
 *
 * @param case_type The case type
 * @returns A case code
 */
export async function get_code_from_case_type(case_type: string): Promise<string> {
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
        ret += `HLM-${formatter.format(current_codes!.limited + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    } else if (case_type == "admin") {
        ret += `HAD-${formatter.format(current_codes!.admin + 1)}-${new Date().getFullYear().toString().slice(2)}`;
    }

    return Promise.resolve(ret);
}

/**
 * Capitalizes each word in a sentence.
 *
 * @param input The input sentence
 * @returns The capitalized input sentence
 */
export function capitalize_each_word(input: string): string {
    return input.split(' ').map(word => {
        if (word.length === 0) {
            return "";
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Generates a random filing id of fourteen characters in length.
 *
 * @returns The filing id.
 */
export function generate_filing_id(): string {
    return "F-" + generator({ chars: 'base32' }).generate(14);
}

/**
 * Generates a unique filing id.
 *
 * @returns A unique filing id
 */
export async function get_unique_filing_id(): Promise<string> {
    const filing_repo = new FilingRepository(new DatabaseClient());
    let filing_id = generate_filing_id();
    while (await filing_repo.get_by_id(filing_id)) {
        filing_id = generate_filing_id();
    }
    return filing_id;
}

/**
 * Formats a date as MONTH DD, YYYY.
 *
 * @param date The date to format
 * @returns The formatted date
 */
export function long_month_date_format(date: Date): string {
    return `${date.toLocaleString("en-US", { month: "long" })} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Returns an updated description with a new filing.
 *
 * @param desc The previous description
 * @param doc_types The document types
 * @param doc_links The document links
 * @param filed_by Who it was filed by
 * @returns A string with the newly formatted data
 */
export function update_filing_record(desc: string, doc_types: string[], doc_links: string[], filed_by: string): string {
    if (doc_types.length != doc_links.length) throw new Error("doc_types and doc_links do not have the same length");

    let new_desc = desc;
    for (let i = 0; i < doc_types.length; i++) {
        new_desc += `${format_date_utc(new Date())} | [${doc_types[i]}](${doc_links[i]}) - Filed By: ${filed_by}\n`;
    }

    return new_desc;
}

/**
 * Gets the case type from a specified court case.
 *
 * @param court_case The court case to receive the type from
 * @returns The type of case
 */
export function get_case_type_from_case(court_case: Case): string {
    let id = court_case.case_code.slice(1, 3);
    if (id == "CV") return "civil";
    if (id == "CM") return "criminal";
    if (id == "LM") return "limited";
    if (id == "AP") return "appeal";
    if (id == "AD") return "admin";

    throw new Error("Invalid case_code");
}

/**
 * Checks if test contains right to left formatting.
 *
 * @param text The text to check
 * @returns A boolean identifying if it contains rtl
 */
export function contains_rtl(text: string): boolean {
    // Covers Hebrew, Arabic, Syriac, Thaana, etc.
    return /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text);
}

/**
 * Turns text into safe formatting text in LTR systems.
 *
 * @param text The text to format
 * @returns Formatted text
 */
export function safe_text(text: string): string {
    return contains_rtl(text) ? `"${text}"` : text;
}

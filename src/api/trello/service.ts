import { copy_card, set_card_labels } from "./card";
import { CASE_LABELS, TEMPLATE_CARDS } from "./constants";

/**
 * Builds a case name based on the case type.
 * 
 * @param type The case type
 * @param plaintiffs The list of plaintiffs
 * @param defendants The list of defendants
 * @returns The formatted case name
 */
export function build_case_name(
    type: string,
    plaintiffs: string[],
    defendants: string[]
): string {
    if (type === "civil" || type === "criminal") {
        const p = plaintiffs.length > 1
            ? `${plaintiffs[0]} et al.`
            : plaintiffs[0];
        const d = defendants.length > 1
            ? `${defendants[0]} et al.`
            : defendants[0];
        return `${p} v. ${d}`;
    }

    if (type === "expungement" || type === "special") {
        return `in re ${plaintiffs.join(", ")}`;
    }

    if (type === "admin") {
        return `in re ${plaintiffs[0]}`;
    }

    throw new Error(`Invalid case type: ${type}`);
}

/**
 * Copies a case card and modifies it.
 * 
 * @param jurisdiction The jurisdiction of the case
 * @param case_type The type of case
 * @param plaintiffs The plaintiffs
 * @param defendants The defendants
 * @returns The data for the new card
 */
export async function copy_case_card(
    jurisdiction: "county" | "circuit",
    case_type: string,
    plaintiffs: string[],
    defendants: string[]
) {
    const template = TEMPLATE_CARDS[jurisdiction];
    if (!template) throw new Error("Invalid Jurisdiction");

    const name = build_case_name(case_type, plaintiffs, defendants);
    return copy_card(template.card_id, template.list_id, name);
}

/**
 * Applies case labels depending on the case type
 * 
 * @param card_id The id of the card
 * @param case_type The case type
 */
export async function apply_case_label(card_id: string, case_type: string) {
    const label = CASE_LABELS[case_type];
    if (!label) throw new Error(`Unknown Case Type: ${case_type}`);
    await set_card_labels(card_id, [label]);
}

/**
 * Gets a trello due date ISO string based on the time_length one wants to set
 * for the deadline.
 * 
 * @param time_length The timelength (in days) for the deadline
 * @returns The ISO string
 */
export function get_trello_due_date(time_length: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + time_length);
    return date.toISOString();
}
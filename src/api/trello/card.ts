import { trello_fetch } from "./client";
import { CaseCard, Label, TrelloCard } from "./types";

/**
 * Maps card data to a CaseCard.
 *
 * @param card The raw card data
 * @returns The new CaseCard
 */
export function map_to_case_card(card: any): CaseCard {
    return {
        id: card.id,
        name: card.name,
        description: card.desc,
        url: card.url,
        deadline: card.due || "",
        boardId: card.idBoard,
        labels: (card.labels || []).map((l: any) => ({
            id: l.id,
            name: l.name,
        })),
    };
}

/**
 * Creates a card.
 *
 * @param list_id The list to place the card in
 * @param card_data The data for the card
 * @returns The new card data
 */
export async function create_card(list_id: string, card_data: TrelloCard) {
    const { name, desc, id_members, id_labels, pos, due, start } = card_data;

    const params = new URLSearchParams();
    params.append("name", card_data.name);
    params.append("idList", list_id);

    if (card_data.desc) params.append("desc", card_data.desc);
    if (card_data.pos) params.append("pos", String(card_data.pos));
    if (card_data.due) params.append("due", card_data.due);
    if (card_data.start) params.append("start", card_data.start);
    if (card_data.id_members && card_data.id_members.length > 0)
        params.append("idMembers", card_data.id_members.join(","));
    if (card_data.id_labels && card_data.id_labels.length > 0)
        params.append("idLabels", card_data.id_labels.join(","));

    const response = await trello_fetch(`/cards?${params.toString()}`, {
        method: "POST",
    });

    return response;
}

/**
 * Copies a card from a template card.
 *
 * @param source_card_id The source id card to copy
 * @param list_id The list to place the card into
 * @param name The name of the new card
 * @returns The copied card data
 */
export async function copy_card(
    source_card_id: string,
    list_id: string,
    name: string
): Promise<CaseCard> {
    const card = await trello_fetch(
        `/cards?idCardSource=${source_card_id}&idList=${list_id}&keepFromSource=all&name=${encodeURIComponent(name)}`,
        { method: "POST" }
    );

    return map_to_case_card(card);
}

/**
 * Updates a card with new data.
 *
 * @param card The new data
 */
export async function update_card(card: CaseCard) {
    const params = new URLSearchParams();

    if (card.name) {
        params.append("name", card.name);
    }

    if (card.description) {
        params.append("desc", card.description);
    }

    if (card.deadline) {
        params.append("due", card.deadline);
    }

    if (card.labels && card.labels.length > 0) {
        params.append("idLabels", card.labels.map(l => l.id).join(","));
    }

    await trello_fetch(
        `/cards/${card.id}?${params.toString()}`,
        { method: "PUT" }
    );
}

/**
 * Sets labels for a card.
 *
 * @param card_id The card id
 * @param labels A list of labels
 */
export async function set_card_labels(card_id: string, labels: Label[]) {
    const ids = labels.map(l => l.id).join(",");
    await trello_fetch(
        `/cards/${card_id}/idLabels&value=${ids}`,
        { method: "PUT" }
    );
}

/**
 * Gets a card by its short link
 *
 * @param short_link The short link to retrieve the card by
 * @returns Card data
 */
export async function get_by_short_link(short_link: string): Promise<CaseCard> {
    const card = await trello_fetch(`/cards/${short_link}`);
    return map_to_case_card(card);
}

/**
 * Gets the case code from a case card.
 *
 * @param card The card
 * @returns Either the HXX-####-## code or null depending on if it exists in the card.
 */
export function get_case_code_from_card(card: CaseCard): string | null {
    const regex = /H[A-Za-z]{2}-\d{4}-\d{2}/;
    const match = card.description.match(regex);
    return match ? match[0] : null;
}

/**
 * Gets a card based on its ID.
 *
 * @param card_id The ID of the card to retrieve
 * @returns The card data
 */
export async function get_card(card_id: string): Promise<TrelloCard | null> {
    return (await trello_fetch(`/cards/${card_id}`)) as TrelloCard;
}

/**
 * Checks if a certain filing type exists in the card's record.
 *
 * @param card The case card we want to check
 * @param filing_type The filing type to check for
 * @returns Whether or not the filing type exists in the record
 */
export function check_if_filing_in_record(card: CaseCard, filing_type: string): boolean {
    if (!card.description) return false;

    const lower = card.description.toLowerCase();
    const target = filing_type.toLowerCase();

    return lower.includes(`[${target}](`) || lower.includes(`| ${target}`);
}

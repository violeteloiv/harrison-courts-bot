import { trello_fetch } from "./client";
import { CaseCard, Label } from "./types";

function map_to_case_card(card: any): CaseCard {
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

export async function update_card(card: CaseCard) {
    await trello_fetch(
        `/cards/${card.id}&name=${card.name}&desc=${card.description}&due=${card.deadline}`,
        { method: "PUT" }
    );
}

export async function set_card_labels(card_id: string, labels: Label[]) {
    const ids = labels.map(l => l.id).join(",");
    await trello_fetch(
        `/cards/${card_id}/idLabels&value=${ids}`,
        { method: "PUT" }
    );
}

export async function get_by_short_link(short_link: string): Promise<CaseCard> {
    const card = await trello_fetch(`/cards/${short_link}`);
    return map_to_case_card(card);
}
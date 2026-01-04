import { trello_fetch } from "./client";

export async function get_lists(board_id: string) {
    return trello_fetch(`/boards/${board_id}/lists`, { method: "GET" });
}

export async function move_card_to_list(card_id: string, list_id: string) {
    await trello_fetch(`/cards/${card_id}&idList=${list_id}`, { method: "PUT" });
}

export async function create_list_next_to(
    name: string,
    board_id: string,
    reference_list_id: string
) {
    const ref = await trello_fetch(`/lists/${reference_list_id}`);
    await trello_fetch(`/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: name,
            idBoard: board_id,
            pos: ref.pos - 1
        })
    });
}
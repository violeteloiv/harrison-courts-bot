import { trello_fetch } from "./client";
import { TrelloCard, TrelloList } from "./types";

/**
 * Gets all the list corresponding to a particular
 * board.
 * 
 * @param board_id The board id
 * @returns An array of lists
 */
export async function get_lists(board_id: string): Promise<TrelloList[]> {
    return trello_fetch(`/boards/${board_id}/lists`, { method: "GET" });
}

/**
 * Moves a particular card to a specific list
 * 
 * @param card_id The card id
 * @param list_id The list id
 */
export async function move_card_to_list(card_id: string, list_id: string) {
    await trello_fetch(`/cards/${card_id}&idList=${list_id}`, { method: "PUT" });
}

/**
 * Creates a list next to another list
 * 
 * @param name The name of the list we are creating
 * @param board_id The id we wish to place the list on
 * @param reference_list_id  The id of the list we are
 * placing to the left of
 */
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

/**
 * Removes a list from a board
 * 
 * @param list_name The name of the list we wish to remove
 * @param board_id The id of the board we wish to remove
 */
export async function remove_list(list_name: string, board_id: string) {
    const lists: any[] = await trello_fetch(`/boards/${board_id}/lists?fields=id,name`);

    const list = lists.find(l => l.name === list_name);
    if (!list) return;

    const list_id = list.id;
    const cards: any[] = await trello_fetch(`/lists/${list_id}/cards`);
    for (const card of cards) {
        await trello_fetch(`/cards/${card.id}`, { method: "DELETE" });
    }

    await trello_fetch(`/lists/${list_id}/closed`, {
        method: "PUT",
        body: JSON.stringify({ value: true }),
        headers: { "Content-Type": "application/json" },
    });
}

/**
 * Gets a list of trello cards based on the list ID the cards are in
 * 
 * @param list_id The ID of the list we want cards from
 * @returns A list of trello cards
 */
export async function get_cards_by_list(list_id: string): Promise<TrelloCard[]> {
    return trello_fetch(
        `/lists/${list_id}/cards`,
        { method: "GET" }
    );
}
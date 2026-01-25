export interface TrelloList {
    id: string;
    name: string;
    closed: boolean;
    idBoard: string;
    pos: number;
    subscribed?: boolean;
    softLimit?: number | null;
}

export interface TrelloCard {
    name: string;            // Title of the card (required)
    id: string;
    desc?: string;           // Description text (optional)
    id_list?: string;          // The list ID the card will be created in
    id_members?: string[];    // Trello member IDs to add to the card
    id_labels?: string[];     // Optional label IDs
    pos?: string | number;   // Position in the list: "top", "bottom", or a number
    due?: string;            // ISO date string for due date (optional)
    start?: string;          // ISO start date (optional)
}

export interface Label {
    id: string;
    name: string;
}

export interface CaseCard {
    id: string;
    name: string;
    description: string;
    labels: Label[];
    deadline: string;
    url: string;
    boardId: string;
}
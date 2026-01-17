export interface TrelloList {
    id: string;
    name: string;
    closed: boolean;
    idBoard: string;
    pos: number;
    subscribed?: boolean;
    softLimit?: number | null;
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
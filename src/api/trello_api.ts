interface Label {
    id: string;
    name: string;
}

interface CaseCard {
    id: string;
    name: string;
    description: string;
    labels: Label[];
    deadline: string;
    url: string;
    boardId: string;
};

const COUNTY_COURT_BOARD_ID = "68929e8db5fe44776b435721";
const CIRCUIT_COURT_BOARD_ID = "6892a4c496df6092610ed5db";

export async function copyCaseCardFromTemplate(jurisdiction: string, case_type: string, plaintiffs: string[], defendents: string[]): Promise<CaseCard> {
    const apiKey = process.env.TRELLO_API_KEY!;
    const apiToken = process.env.TRELLO_TOKEN!;

    // Get the board ID depending on the jurisdiction.
    let list_id, card_id;
    if (jurisdiction == 'county') {
        list_id = "6892a359ff10f18c8b09242d";
        card_id = "68944e50232e7a5cd1f726e0";
    } else if (jurisdiction == 'circuit') {
        list_id = "6892a4c496df6092610ed6dc";
        card_id = "6896e43ff3c33669b7af985a"
    } else {
        return Promise.reject("Jurisdiction invalid.");
    }

    // Generate the name of the card based on the case type.
    // TODO: Implement naming for appeals and administrative cases.
    let case_name = "";
    if (case_type == 'civil' || case_type == 'criminal') {
        if (plaintiffs.length > 1) {
            case_name += `${plaintiffs[0]} et al. v. `;
        } else {
            case_name += `${plaintiffs[0]} v. `;
        }

        if (defendents.length > 1) {
            case_name += `${defendents[0]} et al.`;
        } else {
            case_name += `${defendents[0]}`;
        }
    } else if (case_type == 'expungement' || case_type == 'special') {
        case_name = `in re ${plaintiffs.join(", ")}`;
    } else if (case_type == "admin") {
        case_name = `in re ${plaintiffs[0]}`;
    } else {
        return Promise.reject("Case Type Invalid");
    }

    const copyRes = await fetch(
        `https://api.trello.com/1/cards?idCardSource=${card_id}&idList=${list_id}&keepFromSource=all&name=${encodeURIComponent(
        case_name
        )}&key=${apiKey}&token=${apiToken}`,
        { method: "POST" }
    );

    if (!copyRes.ok) {
        throw new Error(`Failed to copy card: ${await copyRes.text()}`);
    }

    // The copied card JSON includes all standard fields, including labels and due date
    const copiedCard: any = await copyRes.json();

    // Map to your CaseCard interface
    const caseCard: CaseCard = {
        id: copiedCard.id,
        name: copiedCard.name,
        description: copiedCard.desc,
        url: copiedCard.url,
        labels: (copiedCard.labels || []).map((label: any) => ({
            id: label.id,
            name: label.name,
        })),
        deadline: copiedCard.due || "", // empty string if no due date
        boardId: copiedCard.boardId,
    };

    return caseCard;
}

export async function updateTrelloCard(card: CaseCard, case_type: string) {
    const apiKey = process.env.TRELLO_API_KEY!;
    const apiToken = process.env.TRELLO_TOKEN!;

    // Update base card info: name, description, due date
    const params = new URLSearchParams({
        key: apiKey,
        token: apiToken,
        name: card.name,
        desc: card.description,
        due: card.deadline || "", // empty string to clear due date if needed
    });

    const baseUpdateRes = await fetch(`https://api.trello.com/1/cards/${card.id}?${params.toString()}`, {
        method: "PUT",
    });

    if (!baseUpdateRes.ok) {
        throw new Error(`Failed to update card base: ${await baseUpdateRes.text()}`);
    }

    if (case_type == 'civil') {
        card.labels.push({ id: "6897f11ed92e87ddd328ed1b", name: "CIVIL" });
    } else if (case_type == 'criminal') {
        card.labels.push({ id: "6897f125e85d8fe0a3529d90", name: "CRIMINAL" });
    } else if (case_type == 'expungement') {
        card.labels.push({ id: "6897f13b58f531982d709450", name: "EXPUNGEMENT" });
    } else if (case_type == 'special') {
        card.labels.push({ id: "6897f141a2b53de765c705e5", name: "SPECIAL" });
    } else {
        throw new Error(`Supplied case_type: ${case_type} has not been added yet,`);
    }

    // Update labels (set card's labels to match card.labels array)
    // Trello API expects a comma-separated list of label IDs for this
    const labelIds = card.labels.map((label) => label.id).join(",");

    const labelUpdateParams = new URLSearchParams({
        key: apiKey,
        token: apiToken,
        value: labelIds,
    });
    
    console.log(card.labels);

    const labelsUpdateRes = await fetch(
        `https://api.trello.com/1/cards/${card.id}/idLabels?${labelUpdateParams.toString()}`,
        {
            method: "PUT",
        }
    );

    if (!labelsUpdateRes.ok) {
        throw new Error(`Failed to update card labels: ${await labelsUpdateRes.text()}`);
    }
}

export async function getCardFromLink(link: string): Promise<CaseCard> {
    const apiKey = process.env.TRELLO_API_KEY!;
    const apiToken = process.env.TRELLO_TOKEN!;

    // Extract shortLink from the URL
    let short_link;
    if (link) {
        const match = link.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
        if (!match) throw new Error("Invalid Trello card URL");
        short_link = match[1];
    } else {
        throw new Error(`Failed to get link: ${link}`);
    }

    // Fetch card details
    const res = await fetch(
        `https://api.trello.com/1/cards/${short_link}?key=${apiKey}&token=${apiToken}`
    );
    if (!res.ok) {
        throw new Error(`Failed to fetch card: ${res.statusText}`);
    }

    let card = await res.json();
    return {
        id: card.id,
        name: card.name,
        description: card.desc,
        url: card.url,
        labels: (card.labels || []).map((label: any) => ({
            id: label.id,
            name: label.name,
        })),
        deadline: card.due || "", // empty string if no due date
        boardId: card.idBoard,
    }
}

export async function moveCaseCardToCategory(card: CaseCard, list_name: string) {
    const apiKey = process.env.TRELLO_API_KEY!;
    const apiToken = process.env.TRELLO_TOKEN!;

    let res;
    if (list_name == "Docket") {
        const res1 = await fetch(
            `https://api.trello.com/1/boards/${CIRCUIT_COURT_BOARD_ID}/lists?key=${apiKey}&token=${apiToken}`
        );

        if (!res1.ok) {
            throw new Error(`Failed to fetch lists: ${res1.statusText}`);
        }

        const lists: any[] = await res1.json();
        const list = lists.find(l => l.name.toLowerCase() === list_name.toLowerCase());

        if (!list) {
            throw new Error(`List "${list_name}" not found on board ${CIRCUIT_COURT_BOARD_ID}`);
        }

        res = await fetch(
            `https://api.trello.com/1/cards/${card.id}?key=${apiKey}&token=${apiToken}&idList=${list.id}`,
            { method: "PUT" }
        );   
    } else {
        const res1 = await fetch(
            `https://api.trello.com/1/boards/${COUNTY_COURT_BOARD_ID}/lists?key=${apiKey}&token=${apiToken}`
        );

        if (!res1.ok) {
            throw new Error(`Failed to fetch lists: ${res1.statusText}`);
        }

        const lists: any[] = await res1.json();
        const list = lists.find(l => l.name.toLowerCase() === list_name.toLowerCase());

        if (!list) {
            throw new Error(`List "${list_name}" not found on board ${COUNTY_COURT_BOARD_ID}`);
        }

        res = await fetch(
            `https://api.trello.com/1/cards/${card.id}?key=${apiKey}&token=${apiToken}&idList=${list.id}`,
            { method: "PUT" }
        );        
    }

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to move card: ${res.status} ${res.statusText} - ${errText}`);
    }
}

export async function getCardsFromList(list_id: string): Promise<CaseCard[]> {
    const apiKey = process.env.TRELLO_API_KEY!;
    const apiToken = process.env.TRELLO_TOKEN!;

    const url = `https://api.trello.com/1/lists/${list_id}/cards?key=${apiKey}&token=${apiToken}`;
    const res = await fetch(url);

    if (!res.ok) {
        Promise.reject(`Failed to fetch cards from list: ${await res.text()}`);
    }

    const cards: any[] = await res.json();

    return cards.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.desc,
        url: c.url,
        deadline: c.due || "",
        labels: (c.labels || []).map((l: any) => ({
            id: l.id,
            name: l.name,
        })),
        boardId: c.boardId,
    }));
}

export async function createCategoryNextTo(category_name: string, board_id: string, reference_list_id: string) {
    const apiKey = process.env.TRELLO_API_KEY!;
    const apiToken = process.env.TRELLO_TOKEN!;

    const refListRes = await fetch(
        `https://api.trello.com/1/lists/${reference_list_id}?key=${apiKey}&token=${apiToken}`
    );
    const refList = await refListRes.json();

    await fetch(
        `https://api.trello.com/1/lists?key=${apiKey}&token=${apiToken}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: category_name,
                idBoard: board_id,
                pos: refList.pos - 1,
            }),
        }
    );
}

export async function removeCategory(category_name: string, board_id: string) {
    const apiKey = process.env.TRELLO_API_KEY!;
    const apiToken = process.env.TRELLO_TOKEN!;

    const res = await fetch(
        `https://api.trello.com/1/boards/${board_id}/lists?key=${apiKey}&token=${apiToken}`
    );
    const lists = await res.json();

    const list = lists.find((l: any) => l.name === category_name);
    if (!list) {
        throw new Error(`List with name "${category_name}" not found on board ${board_id}`);
    }

    const remove_res = await fetch(
        `https://api.trello.com/1/lists/${list.id}?key=${apiKey}&token=${apiToken}&closed=true`,
        {
            method: "PUT",
        }
    );

    if (!remove_res.ok) {
        throw new Error(`Failed to archive list: ${remove_res.statusText}`);
    }
}

export function getTrelloDueDate(daysFromNow: number): string {
  const now = new Date();
  now.setDate(now.getDate() + daysFromNow);
  return now.toISOString(); // Trello accepts this format
}

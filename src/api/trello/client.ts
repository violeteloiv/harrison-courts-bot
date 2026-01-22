const BASE_URL = "https://api.trello.com/1";

/**
 * Gets the authorization params for the trello api.
 * 
 * @returns The URL Search Params for authorization
 */
function auth_params() {
    return new URLSearchParams({
        key: process.env.TRELLO_API_KEY!,
        token: process.env.TRELLO_TOKEN!
    });
}

/**
 * Utilizes the trello api to fetch or update data.
 * 
 * @param path The API path
 * @param options Options for the request
 * @returns Any data from the request
 */
export async function trello_fetch(
    path: string,
    options: RequestInit = {}
) {
    const url =
        `${BASE_URL}${path}` +
        (path.includes("?") ? "&" : "?") +
        auth_params().toString();

    const res = await fetch(url, options);
    if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
    }

    return res.json();
}
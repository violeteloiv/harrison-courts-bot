import { OAuth2Client } from "google-auth-library";
import get_auth_client from "../../token";
import { google } from "googleapis";
import { BAR_DATABASE_RANGE, BAR_DATABASE_SPREADSHEET_ID } from "../../config";

export interface BarData {
    bar_number: number,
    username: string,
    type: string,
    status: string,
}

/**
 * Gets the client which allows us to communicate with the
 * sheets API.
 * 
 * @returns The API client
 */
export async function get_sheets_client() {
    const auth = (await get_auth_client()) as OAuth2Client;
    return google.sheets({ version: "v4", auth });
}

/**
 * Gets data for a particular user from the bar database.
 * 
 * @param username The username for the user we are fetching
 * data for
 * @returns The bar data for the user, or undefined if no data
 * exists 
 */
export async function get_bar_data(username: string) {
    const sheets = await get_sheets_client();

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: BAR_DATABASE_SPREADSHEET_ID,
        range: BAR_DATABASE_RANGE,
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) return undefined;

    for (const row of rows) {
        const [bar_number, row_username, type, status] = row;

        if (row_username === username) {
            return {
                bar_number: Number(bar_number),
                username: row_username,
                type: type ?? "",
                status: status ?? "",
            };
        }
    }

    return undefined;
}
import { OAuth2Client } from "google-auth-library";
import getAuthClient from "../token";
import { google } from "googleapis";

export interface BarData {
    bar_number: number,
    username: string,
    type: string,
    status: string,
}

export async function getBarDatabaseDataFromUsername(username: string): Promise<BarData | undefined> {
    let authClient;
    try {
        authClient =  await getAuthClient() as OAuth2Client;
    } catch(error) {
        return Promise.reject(error);
    }

    try {
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        const resp = await sheets.spreadsheets.values.get({
            spreadsheetId: "1y6vbtjiGc4hlWY2PpNTlCHwXRNh07ZchgPz-qgS6dDE",
            range: "Licence Register!A1:H47"
        });
        
        const values = resp.data.values || [];
        for (let row = 0; row < values.length; row++) {
            for (let col = 0; col < (values[row]?.length || 0); col++) {
                if (values[row][col] == username) {
                    return Promise.resolve({
                        bar_number: parseInt(values[row][col - 1], 10),
                        username: username,
                        type: values[row][col + 1],
                        status: values[row][col + 2]
                    });
                }
            }
        }

        return Promise.resolve(undefined);
    } catch (error) {
        Promise.reject(error);
    }
}
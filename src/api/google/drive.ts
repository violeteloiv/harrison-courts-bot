import { google } from "googleapis";
import getAuthClient from "../../token";
import { OAuth2Client } from "google-auth-library";
import { PassThrough, Readable } from "stream";

export type DriveClient = ReturnType<typeof google.drive>;

const folder_ids: Record<string, string> = {
    "January 2026": "1Yrvfc8kPlvNKiDWScGFrKUPjXCUjL-8o",
    "February 2026": "",
};

/**
 * Gets a client to interact with the google drive API.
 *  
 * @returns The drive client
 */
export async function get_drive_client(): Promise<DriveClient> {
    const auth = (await getAuthClient()) as OAuth2Client;
    return google.drive({ version: "v3", auth });
}

/**
 * Gets the destination folder for case processing based on the current 
 * date.
 * 
 * @returns The folder ID of the case filings folder.
 */
export function get_destination_folder(): string {
    const now = new Date();
    const month = now.toLocaleString("default", { month: "long" });
    const year = now.getFullYear();
    const key = `${month} ${year}`;

    const folder_id = folder_ids[key];
    if (!folder_id) {
        throw new Error(`No Destination Folder Configured For: ${key}`);
    }

    return folder_id;
}

/**
 * From a link, extract the file ID.
 * 
 * @param link The link of the file
 * @returns The file ID
 */
export function extract_file_id(link: string): string {
    const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
        throw new Error(`Invalid Google File Link: ${link}`);
    }
    return match[1];
}

/**
 * Given a stream, uploads that data to google drive.
 * 
 * @param stream The data stream
 * @param filename The name of the file
 * @param folder_id The folder to place the stream in
 * @param mime_type The data type
 * @returns The data of the uploaded file
 */
export async function upload_stream_to_drive(
    stream: PassThrough, 
    filename: string,
    folder_id: string, 
    mime_type: string
) {
    const drive = await get_drive_client();
    
    const file_meta_data = { name: filename, parents: [folder_id] };
    const media = { mimeType: mime_type, body: stream };

    const res = await drive.files.create({
        requestBody: file_meta_data,
        media: media,
        fields: "id, webViewLink, webContentLink",
    });

    return res.data;
}

/**
 * Creates a timestamped string
 * 
 * @param base The base which shall be timestamped
 * @returns The final timestamped string
 */
export function timestamped_name(base: string): string {
    const now = new Date();
    return `${base}, ${now.toLocaleString("default", { month: "long" })} ${now.getDate()}, ${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}`;
}

/**
 * Copies a file
 * 
 * @param drive The drive client 
 * @param file_id The ID of the file to copy
 * @param name The name of the new file
 * @param parents The folders to place the file in
 * @returns The file ID of the new file
 */
export async function copy_file(
    drive: DriveClient,
    file_id: string,
    name: string,
    parents: string[]
) {
    const res = await drive.files.copy({
        fileId: file_id,
        supportsAllDrives: true,
        requestBody: { name, parents },
    });

    if (!res.data.id) {
        throw new Error("File Copy Returned No ID");
    }
    return res.data.id;
}

/**
 * Exports a file as a pdf.
 * 
 * @param drive The drive client
 * @param file_id The id of the file to turn into a pdf
 * @returns The data of the new pdf file
 */
export async function export_file_as_pdf(
    drive: DriveClient,
    file_id: string
): Promise<Readable> {
    const res = await drive.files.export(
        { fileId: file_id, mimeType: "application/pdf" },
        { responseType: "stream" }
    );
    return res.data as Readable;
}

/**
 * Uploads a pdf to google drive
 * 
 * @param drive The google drive client
 * @param name The name of the file
 * @param body The data of the file
 * @param parents The parent folders to place the file into
 * @returns The data of the new file
 */
export async function upload_pdf(
    drive: DriveClient,
    name: string,
    body: Readable,
    parents: string[]
) {
    const res = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
            name: name,
            parents: parents,
            mimeType: "application/pdf"
        },
        media: {
            mimeType: "application/pdf",
            body: body
        },
        fields: "id, webViewLink",
    });

    if (!res.data.id || !res.data.webViewLink) {
        throw new Error("Upload Failed To Return ID or Link");
    }

    return res.data;
}

/**
 * Makes a file public.
 * 
 * @param drive The drive client
 * @param file_id The file ID to make public
 */
export async function make_public(drive: DriveClient, file_id: string) {
    await drive.permissions.create({
        fileId: file_id,
        requestBody: {
            type: "anyone",
            role: "reader",
        }
    });
}

/**
 * Deletes a particular file.
 * 
 * @param drive The drive client
 * @param file_id The file ID to delete
 */
export async function delete_file(drive: DriveClient, file_id: string) {
    await drive.files.delete({ fileId: file_id });
}
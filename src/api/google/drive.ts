import { google } from "googleapis";
import getAuthClient from "../../token";
import { OAuth2Client } from "google-auth-library";
import { Readable } from "stream";

export type DriveClient = ReturnType<typeof google.drive>;

const folder_ids: Record<string, string> = {
    "January 2026": "1Yrvfc8kPlvNKiDWScGFrKUPjXCUjL-8o",
    "February 2026": "",
};

export async function get_drive_client(): Promise<DriveClient> {
    const auth = (await getAuthClient()) as OAuth2Client;
    return google.drive({ version: "v3", auth });
}

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

export function extract_file_id(link: string): string {
    const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
        throw new Error(`Invalid Google File Link: ${link}`);
    }
    return match[1];
}

export function timestamped_name(base: string): string {
    const now = new Date();
    return `${base}, ${now.toLocaleString("default", { month: "long" })} ${now.getDate()}, ${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}`;
}

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

export async function make_public(drive: DriveClient, file_id: string) {
    await drive.permissions.create({
        fileId: file_id,
        requestBody: {
            type: "anyone",
            role: "reader",
        }
    });
}

export async function delete_file(drive: DriveClient, file_id: string) {
    await drive.files.delete({ fileId: file_id });
}
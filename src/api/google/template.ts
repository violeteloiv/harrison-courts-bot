import { google } from "googleapis";
import get_auth_client from "../../token";
import { copy_file, delete_file, export_file_as_pdf, get_destination_folder, get_drive_client, make_public, timestamped_name, upload_pdf } from "./drive";
import { Readable } from "stream";

export type TemplateReplacementMap = Record<string, string>;

export interface TemplateConfig {
    template_id: string;
    title_prefix: string;
    replacements: TemplateReplacementMap;
}

/**
 * Formats a party name based on its length.
 * 
 * @param names The names of the pary
 * @returns The formatted string
 */
function format_party(names: string[]): string {
    return names.length > 1 ? `${names[0]} et al.` : names[0];
}

/**
 * Gets today in MONTH DD, YYYY format.
 * 
 * @returns The date in the above format
 */
function today(): string {
    const now = new Date();
    return `${now.toLocaleString("default", { month: "long" })} ${now.getDate()}, ${now.getFullYear()}`;
}

/**
 * Builds a drive file replace object.
 * 
 * @param find The text to find
 * @param replace_text The text to replace
 * @returns The drive filed replace object
 */
function replace(find: string, replace_text: string) {
    return {
        replaceAllText: {
            containsText: {
                text: find,
                matchCase: true,
            },
            replaceText: replace_text,
        },
    };
}

/**
 * A helper function to create a template document
 * 
 * @param config The configuration of the document
 * @returns A link to the new file
 */
export async function create_template_document(
    config: TemplateConfig
): Promise<string> {
    const auth = await get_auth_client();
    const docs = google.docs({ version: "v1", auth });
    const drive = await get_drive_client();

    const folder = get_destination_folder();
    const base_name = timestamped_name(config.title_prefix);

    const doc_id = await copy_file(drive, config.template_id, base_name, [folder]);
    const requests = Object.entries(config.replacements).map(
        ([key, value]) => replace(key, value)
    );

    await docs.documents.batchUpdate({
        documentId: doc_id,
        requestBody: { requests }
    });

    const pdf_stream = await export_file_as_pdf(drive, doc_id);
    const uploaded = await upload_pdf(drive, `${base_name}.pdf`, pdf_stream as Readable, [folder]);
    await make_public(drive, uploaded.id!);
    await delete_file(drive, doc_id);

    return uploaded.webViewLink!;
}

export const TemplateUtils = {
    today, format_party
}
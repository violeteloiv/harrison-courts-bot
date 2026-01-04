import { Attachment } from "discord.js";
import { copy_file, delete_file, export_file_as_pdf, extract_file_id, get_destination_folder, get_drive_client, make_public, timestamped_name, upload_pdf } from "./drive";
import axios from "axios";
import { Readable } from "stream";

export interface DefaultFilingData {
    case_code: string;
    doc_type: string;
}

export async function copy_and_store(
    doc_link: string, 
    data: DefaultFilingData
): Promise<string> {
    const drive = await get_drive_client();
    const folder = get_destination_folder();

    const source_id = extract_file_id(doc_link);
    const base_name = timestamped_name(`${data.doc_type}, ${data.case_code}`);

    const copied_id = await copy_file(drive, source_id, base_name, [folder]);
    const pdf_stream = await export_file_as_pdf(drive, copied_id);
    const uploaded = await upload_pdf(drive, `${base_name}.pdf`, pdf_stream, [folder]);
    await make_public(drive, uploaded.id!);
    await delete_file(drive, copied_id);

    return uploaded.webViewLink!;
}

export async function upload_and_store(
    attachment: Attachment,
    data: DefaultFilingData
): Promise<string> {
    const drive = await get_drive_client();
    const folder = get_destination_folder();

    const base_name = timestamped_name(`${data.doc_type}, ${data.case_code}`);
    const response = await axios.get(attachment.url, {
        responseType: "stream",
    });

    const uploaded = await upload_pdf(drive, base_name, response.data as Readable, [folder]);
    await make_public(drive, uploaded.id!);

    return uploaded.webViewLink!;
}

export async function delete_docs(links: string[]) {
    const drive = await get_drive_client();

    for (const link of links) {
        const file_id = extract_file_id(link);
        await delete_file(drive, file_id);
    }
}
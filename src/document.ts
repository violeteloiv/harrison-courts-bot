import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { Readable } from "stream";
import getAuthClient from "./token";

export interface NOAData {
    case_id: string,
    plaintiffs: string[],
    defendants: string[],
    presiding_judge: string,
    jurisdiction: string,
    username: string,
    bar_number: number,
    party: string,
};

export interface DefaultFilingData {
    case_id: string,
    doc_type: string,
}

const folder_ids: { [key: string]: string } = {
    ["August 2025"]: "19ha5_Uhx0cyhlQ37N9mEmgm4jq-1DHq3"
}

function getDestinationFolder(): string {
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();

    const dest_folder_name = `${monthName} ${year}`;
    return folder_ids[dest_folder_name];
}

export async function copyAndStoreDocument(doc: string, data: DefaultFilingData): Promise<string> {
    let authClient;
    try {
        authClient =  await getAuthClient() as OAuth2Client;
    } catch(error) {
        return Promise.reject(error);
    }

    const drive = google.drive({ version: 'v3', auth: authClient });

    // Get the file ID from the document link.
    const match = doc.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const fileId = match ? match[1] : null;

    let copy_response;
    try {
        copy_response = await drive.files.copy({ 
            fileId: fileId!, 
            supportsAllDrives: true,
            requestBody: {
                name: `${data.doc_type}, ${data.case_id}, ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getDate()}, ${new Date().getFullYear()} ${new Date().getHours()}:${new Date().getMinutes()}`,
                parents: [getDestinationFolder()]
            } 
        });
    } catch (error) {
        return Promise.reject(error);
    }

    let new_document_id;
    if (copy_response.data.id) {
        new_document_id = copy_response.data.id;   
    } else {
        return Promise.reject("Copying the file yielded no Google ID");
    }

    // Export the file as a PDF
    let export_response;
    try {
        export_response = await drive.files.export(
            { fileId: new_document_id, mimeType: 'application/pdf' },
            { responseType: 'stream' }
        );
    } catch(error) {
        return Promise.reject(error);
    }

    let upload_response;
    try {
        upload_response = await drive.files.create({
            requestBody: {
                name: `${copy_response.data.name}.pdf`,
                parents: [getDestinationFolder()],
                mimeType: 'application/pdf'
            },
            supportsAllDrives: true,
            media: { mimeType: 'application/pdf', body: export_response.data as Readable },
            fields: 'id, webViewLink'
        });
    } catch (error) {
        return Promise.reject(error);
    }

    try {
        await drive.permissions.create({
            fileId: upload_response.data.id!,
            requestBody: {
                type: 'anyone',
                role: 'reader',
            },
        });
    } catch (error) {
        return Promise.reject(error);
    }
    
    // Delete the original document
    try {
        await drive.files.delete({ fileId: new_document_id });
    } catch (error) {
        return Promise.reject(error);
    }

    return Promise.resolve(upload_response.data.webViewLink!);
}

export async function deleteDocuments(docs: string[]) {
    let authClient;
    try {
        authClient =  await getAuthClient() as OAuth2Client;
    } catch(error) {
        return Promise.reject(error);
    }

    const drive = google.drive({ version: 'v3', auth: authClient });

    for (const link in docs) {
        const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) {
            throw new Error(`Invalid doc link: ${link}`);
        }
        const fileId = match[1];

        try {
            await drive.files.delete({ fileId });
        } catch (err) {
            throw new Error(`Failed to delete ${fileId}: ${err}`);
        }
    }
}

export async function createAndStoreNOA(data: NOAData): Promise<string> {
    let authClient;
    try {
        authClient =  await getAuthClient() as OAuth2Client;
    } catch(error) {
        return Promise.reject(error);
    }

    const docs = google.docs({ version: 'v1', auth: authClient });
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Copy the NOA template.
    let copy_response;
    try {
        copy_response = await drive.files.copy({ 
            fileId: "1PaWRGt2VzWqWOB0yMEyMgUn5c7EpokRge7MB_-oLoeM",
            supportsAllDrives: true,
            requestBody: {
                name: `Notice of Appearance, ${data.case_id}, ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getDate()}, ${new Date().getFullYear()} ${new Date().getHours()}:${new Date().getMinutes()}`,
                parents: [getDestinationFolder()]
            } 
        });
    } catch (error) {
        return Promise.reject(error);
    }

    let new_document_id;
    if (copy_response.data.id) {
        new_document_id = copy_response.data.id;   
    } else {
        return Promise.reject("Copying the file yielded no Google ID");
    }

    // Prettify data.
    let plaintiffs = data.plaintiffs.join(", ");
    let defendants = data.defendants.join(", ");

    // Fill out the template based on the data provided.
    try {
        await docs.documents.batchUpdate({
            documentId: new_document_id,
            requestBody: {
                requests: [
                    {
                        replaceAllText: {
                            containsText: { text: '{{Case#}}', matchCase: true },
                            replaceText: data.case_id
                        }
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '{{Plaintiffs}}', matchCase: true },
                            replaceText: plaintiffs
                        }
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '{{Defendants}}', matchCase: true },
                            replaceText: defendants
                        }
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '{{Judge}}', matchCase: true },
                            replaceText: data.presiding_judge
                        }
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '{{Name}}', matchCase: true },
                            replaceText: data.username
                        }
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '{{Bar#}}', matchCase: true },
                            replaceText: data.bar_number.toString()
                        }
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '{{Date}}', matchCase: true },
                            replaceText: `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getDate()}, ${new Date().getFullYear()}`
                        }
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '{{Jurisdiction}}', matchCase: true },
                            replaceText: `${data.jurisdiction}`
                        }
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '{{Party}}', matchCase: true },
                            replaceText: `${data.party}`
                        }
                    }
                ]
            }
        });
    } catch (error) {
        return Promise.reject(error);
    }

    // Export the file as a PDF
    let export_response;
    try {
        export_response = await drive.files.export(
            { fileId: new_document_id, mimeType: 'application/pdf' },
            { responseType: 'stream' }
        );
    } catch(error) {
        return Promise.reject(error);
    }

    let upload_response;
    try {
        upload_response = await drive.files.create({
            requestBody: {
                name: `${copy_response.data.name}.pdf`,
                parents: [getDestinationFolder()],
                mimeType: 'application/pdf'
            },
            supportsAllDrives: true,
            media: { mimeType: 'application/pdf', body: export_response.data as Readable },
            fields: 'id, webViewLink'
        });
    } catch (error) {
        return Promise.reject(error);
    }

    try {
        await drive.permissions.create({
            fileId: upload_response.data.id!,
            requestBody: {
                type: 'anyone',
                role: 'reader',
            },
        });
    } catch (error) {
        return Promise.reject(error);
    }
    
    // Delete the original document
    try {
        await drive.files.delete({ fileId: new_document_id });
    } catch (error) {
        return Promise.reject(error);
    }

    // Get the shareable link.
    return Promise.resolve(upload_response.data.webViewLink!);
}
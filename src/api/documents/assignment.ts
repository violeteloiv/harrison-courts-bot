import { OAuth2Client } from "google-auth-library";
import { getDestinationFolder } from "../doc_api";
import getAuthClient from "../../token";
import { google } from "googleapis";
import { Readable } from "stream";

export interface AssignmentData {
    case_id: string,
    plaintiffs: string[],
    defendants: string[],
    presiding_judge: string,
    jurisdiction: string,
    username: string,
};

export async function createAndStoreAssignment(data: AssignmentData): Promise<string> {
    let authClient;
    try {
        authClient =  await getAuthClient() as OAuth2Client;
    } catch(error) {
        return Promise.reject(error);
    }

    const docs = google.docs({ version: 'v1', auth: authClient });
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Copy the Assignment template.
    let copy_response;
    try {
        copy_response = await drive.files.copy({ 
            fileId: "1DBPAfDLCE43aBXcr5IgEfrmbi95FGNs45pZLMNmd7Cg",
            supportsAllDrives: true,
            requestBody: {
                name: `Assignment, ${data.case_id}, ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getDate()}, ${new Date().getFullYear()} ${new Date().getHours()}:${new Date().getMinutes()}`,
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

    let plaintiffs, defendants;
    if (data.plaintiffs.length > 1) {
        plaintiffs = `${data.plaintiffs[0]} et al.`;
    } else {
        plaintiffs = `${data.plaintiffs[0]}`;
    }

    if (data.defendants.length > 1) {
        defendants = `${data.defendants[0]} et al.`;
    } else {
        defendants = `${data.defendants[0]}`;
    }

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
                            containsText: { text: '{{Date}}', matchCase: true },
                            replaceText: `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getDate()}, ${new Date().getFullYear()}`
                        }
                    },
                    {
                        replaceAllText: {
                            containsText: { text: '{{Jurisdiction}}', matchCase: true },
                            replaceText: `${data.jurisdiction}`
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
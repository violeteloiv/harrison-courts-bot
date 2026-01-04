import { create_template_document, TemplateUtils } from "./template";

export interface AssignmentData {
    case_code: string;
    plaintiffs: string[];
    defendants: string[];
    presiding_judge: string;
    jurisdiction: string;
    username: string;
}

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

export interface ReassignmentData {
    case_code: string,
    plaintiffs: string[],
    defendants: string[],
    presiding_judge: string,
    jurisdiction: string,
    username: string,
};


const ASSIGNMENT_TEMPLATE_ID = "1DBPAfDLCE43aBXcr5IgEfrmbi95FGNs45pZLMNmd7Cg";
const NOA_TEMPLATE_ID = "1PaWRGt2VzWqWOB0yMEyMgUn5c7EpokRge7MB_-oLoeM";
const REASSIGNMENT_TEMPLATE_ID = "1yfzR9WVyeEM4RHnwlxBZQjlWUD5bna4CsFvSSeTYeq8";

export async function create_and_store_assignment(
    data: AssignmentData
): Promise<string> {
    return create_template_document({
        template_id: ASSIGNMENT_TEMPLATE_ID,
        title_prefix: `Assignment, ${data.case_code}`,
        replacements: {
            "{{Case#}}": data.case_code,
            "{{Plaintiffs}}": TemplateUtils.format_party(data.plaintiffs),
            "{{Defendants}}": TemplateUtils.format_party(data.defendants),
            "{{Judge}}": data.presiding_judge,
            "{{Name}}": data.username,
            "{{Date}}": TemplateUtils.today(),
            "{{Jurisdiction}}": data.jurisdiction,
        }
    });
}

export async function createAndStoreNOA(
    data: NOAData
): Promise<string> {
    return create_template_document({
        template_id: NOA_TEMPLATE_ID,
        title_prefix: `Notice of Appearance, ${data.case_id}`,
        replacements: {
            "{{Case#}}": data.case_id,
            "{{Plaintiffs}}": TemplateUtils.format_party(data.plaintiffs),
            "{{Defendants}}": TemplateUtils.format_party(data.defendants),
            "{{Judge}}": data.presiding_judge,
            "{{Name}}": data.username,
            "{{Bar#}}": data.bar_number.toString(),
            "{{Date}}": TemplateUtils.today(),
            "{{Jurisdiction}}": data.jurisdiction,
            "{{Party}}": data.party,
        },
    });
}

export async function create_and_store_reassignment(
    data: ReassignmentData
): Promise<string> {
    return create_template_document({
        template_id: ASSIGNMENT_TEMPLATE_ID,
        title_prefix: `Assignment, ${data.case_code}`,
        replacements: {
            "{{Case#}}": data.case_code,
            "{{Plaintiffs}}": TemplateUtils.format_party(data.plaintiffs),
            "{{Defendants}}": TemplateUtils.format_party(data.defendants),
            "{{Judge}}": data.presiding_judge,
            "{{Name}}": data.username,
            "{{Date}}": TemplateUtils.today(),
            "{{Jurisdiction}}": data.jurisdiction,
        }
    });
}
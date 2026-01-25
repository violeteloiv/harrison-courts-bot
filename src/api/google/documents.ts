import { ASSIGNMENT_TEMPLATE_ID, NOA_TEMPLATE_ID, REASSIGNMENT_TEMPLATE_ID } from "../../config";
import { create_template_document, TemplateUtils } from "./template";

export interface AssignmentData {
    case_code: string;
    plaintiffs: string[];
    defendants: string[];
    presiding_judge: string;
}

/**
 * Creates and stores a document corresponding to a case
 * assignment to a judge.
 * 
 * @param data Data for the assignment
 * @returns A link to the document
 */
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
            "{{Date}}": TemplateUtils.today(),
        }
    });
}

export interface NOAData {
    case_id: string,
    plaintiffs: string[],
    defendants: string[],
    presiding_judge: string,
    username: string,
    bar_number: number,
    party: string,
};

/**
 * Creates and stores a document corresponding to a notice
 * or appearance for an attorney.
 * 
 * @param data Data for the NOA
 * @returns A link to the document
 */
export async function create_and_store_noa(
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
            "{{Party}}": data.party,
        },
    });
}

export interface ReassignmentData {
    case_code: string,
    plaintiffs: string[],
    defendants: string[],
    presiding_judge: string,
};

/**
 * Creates and stores a document corresponding to a case
 * reassignment to a judge.
 * 
 * @param data Data for the reassignment
 * @returns A link to the document
 */
export async function create_and_store_reassignment(
    data: ReassignmentData
): Promise<string> {
    return create_template_document({
        template_id: REASSIGNMENT_TEMPLATE_ID,
        title_prefix: `Assignment, ${data.case_code}`,
        replacements: {
            "{{Case#}}": data.case_code,
            "{{Plaintiffs}}": TemplateUtils.format_party(data.plaintiffs),
            "{{Defendants}}": TemplateUtils.format_party(data.defendants),
            "{{Judge}}": data.presiding_judge,
            "{{Date}}": TemplateUtils.today(),
        }
    });
}
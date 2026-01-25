import { COURTS_GROUP_ID, COURTS_SERVER_ID, DA_GROUP_ID, MAIN_GROUP_ID } from "../config";
import { get_roles_from_user } from "./discord/user";
import { get_bar_data } from "./google/sheets";
import { user_has_rank } from "./roblox";

/**
 * @remark The way permissions are being handled in this program is through
 * bit operations to determine whether a specific permissions is had.
 */
export const permissions_list = {
    RESIDENT:           0b00000001,
    ATTORNEY:           0b00000010,
    PROSECUTOR:         0b00000100,
    COUNTY_JUDGE:       0b00001000,
    DEPUTY_CLERK:       0b00010000,
    CIRCUIT_JUDGE:      0b00100000,
    REGISTRAR:          0b01000000,
    ADMINISTRATOR:      0b10000000,

    JUDGE_PLUS:         0b11111000,
    ATTORNEY_PLUS:      0b11111110,

    JUDGE:              0b00101000,
    CLERK:              0b01010000,
};

/**
 * Computes the permission of an individual based on their rank in a variety of roblox groups
 * and their status in the bar database.
 * 
 * @param roblox_id The roblox id of the user
 * @param discord_nickname The discord nickname of the user
 * @returns The numerical permission based on the bitvalues of a particular permission
 */
export async function compute_permissions(roblox_id: number, discord_nickname: string): Promise<number> {
    let perms = 0;

    if (await user_has_rank(roblox_id, MAIN_GROUP_ID, "Resident")) perms |= permissions_list.RESIDENT;

    const bar_data = await get_bar_data(discord_nickname);
    if (bar_data?.status === "Active") perms |= permissions_list.ATTORNEY;

    const da_roles = [
        "Assistant District Attorney",
        "Senior Assistant District Attorney",
        "Chief Assistant District Attorney",
        "Deputy District Attorney",
        "District Attorney"
    ];
    for (const role of da_roles) {
        if (await user_has_rank(roblox_id, DA_GROUP_ID, role)) {
            perms |= permissions_list.PROSECUTOR;
            break;
        }
    }

    const county_roles = ["Justice of the Peace", "County Judge"];
    for (const role of county_roles) {
        if (await user_has_rank(roblox_id, COURTS_GROUP_ID, role)) {
            perms |= permissions_list.COUNTY_JUDGE;
            break;
        }
    }

    if (await user_has_rank(roblox_id, COURTS_GROUP_ID, "Deputy Clerk")) perms |= permissions_list.DEPUTY_CLERK;
    if (await user_has_rank(roblox_id, COURTS_GROUP_ID, "Circuit Judge") || await user_has_rank(roblox_id, COURTS_GROUP_ID, "Chief Judge")) perms |= permissions_list.CIRCUIT_JUDGE;
    if (await user_has_rank(roblox_id, COURTS_GROUP_ID, "Chief Clerk")) perms |= permissions_list.REGISTRAR;
    if (await user_has_rank(roblox_id, COURTS_GROUP_ID, "Chief Judge") ||
        await user_has_rank(roblox_id, COURTS_GROUP_ID, "Administrative Judge") ||
        roblox_id === 370917506) {
            perms |= permissions_list.ADMINISTRATOR;
            const courts_roles = await get_roles_from_user(discord_nickname, COURTS_SERVER_ID);
            if (courts_roles.includes("County Judge")) {
                perms |= permissions_list.COUNTY_JUDGE;
            } else if (courts_roles.includes("Circuit Judge")) {
                perms |= permissions_list.CIRCUIT_JUDGE;
            }
        }

    return perms;
}

/**
 * Formats the permissions of a user in a particular way suited to 
 * the register command.
 * 
 * @param perm The permission
 * @returns A string version of the permission
 */
export function get_permission_string(perm: number): string {
    let str = "- **Permissions:**";
    if ((perm & permissions_list.RESIDENT) > 0) {
        str += " `Resident`,";
    }

    if ((perm & permissions_list.PROSECUTOR) > 0) {
        str += " `Prosecutor`,";
    } else if ((perm & permissions_list.ATTORNEY) > 0) {
        str += " `Attorney`,";
    }

    if ((perm & permissions_list.JUDGE) > 0) {
        str += " `Judge`,";
    }

    if ((perm & permissions_list.CLERK) > 0) {
        str += " `Clerk`,";
    }

    if ((perm & permissions_list.ADMINISTRATOR) > 0) {
        str += " `Admin`,";
    }

    if (perm == 0) {
        str += " `None`,";
    }

    str = str.slice(0, -1);

    return str;
}
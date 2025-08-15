import { pool } from "./db";

// BASIC API FUNCTIONS

export interface Column {
    name: string,
    type: string,
};

export async function createTable(name: string, column_data: Column[]) {
    // Check if the table exists.
    let check_sql = `SELECT EXISTS ( SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${name}' );`
    const check_result = await pool.query(check_sql);

    if (!check_result.rows[0].exists) {
        let sql = `CREATE TABLE ${name} (`;
        column_data.forEach((column) => {
            sql += `${column.name} ${column.type},`
        });
        sql = sql.slice(0, -1);
        sql += ');';

        return await pool.query(sql);
    }
}

// CASE CODE SPECIFIC CALLS
export async function getCurrentCaseCodes() {
    let sql = `SELECT * FROM case_codes`;
    const result = await pool.query(sql);

    if (result.rowCount) {
        return result.rows[0];
    } else {
        throw new Error("No case codes received from the database.");
    }
}

export async function updateSpecificCaseCode(case_type: string, new_num: number) {
    let sql = `UPDATE case_codes SET ${case_type}=${new_num}`;
    await pool.query(sql);
}

// FILING SPECIFIC CALLS
export async function getFilingByID(filing_id: string) {
    let sql = `SELECT * FROM filings WHERE filing_id='${filing_id}'`;
    const result = await pool.query(sql);

    if (result.rowCount) {
        return result.rows;
    }
    
    return null;
}

export async function insertFiling(filing_id: string, case_id: string, party: string, filed_by: string, types: string[], documents: string[]) {
    let sql = `INSERT INTO filings (filing_id, case_id, party, filed_by, types, documents, date) VALUES ('${filing_id}', '${case_id}', '${party}', ${filed_by}, '{`;
    types.forEach((type) => {
        sql += `"${type}",`;
    });
    sql = sql.slice(0, -1);
    sql += "}', '{";
    documents.forEach((doc) => {
        sql += `"${doc}",`;
    });
    sql = sql.slice(0, -1);
    sql += "}', NOW());";

    await pool.query(sql);
}

// CASE SPECIFIC CALLS
export async function insertCase(case_code: string, judge: string, card_link: string, channel: string, status: string, sealed: boolean, plaintiffs: string[], defendants: string[], representing_plaintiffs: string[], representing_defendants: string[], filings: string[]) {
    let judge_value;
    if (judge == "") {
        judge_value = "0";
    } else {
        judge_value = judge;
    }

    let channel_value;
    if (channel == "") {
        channel_value = "0";
    } else {
        channel_value = channel;
    }

    let sql = `INSERT INTO cases (case_code, judge, card_link, channel, status, sealed, plaintiffs, defendants, representing_plaintiffs, representing_defendants, filings) VALUES ('${case_code}', ${judge_value}, '${card_link}', ${channel_value}, '${status}', ${sealed}, '{`;
    if (plaintiffs.length != 0) {
        plaintiffs.forEach((plaintiff) => {
            sql += `"${plaintiff}",`;
        });
        sql = sql.slice(0, -1);
    }
    sql += "}', '{";
    if (defendants.length != 0) {
        defendants.forEach((defendant) => {
            sql += `"${defendant}",`;
        });
        sql = sql.slice(0, -1);
    }
    sql += "}', '{";
    if (representing_plaintiffs.length != 0) {
        representing_plaintiffs.forEach((rep_plain) => {
            sql += `${rep_plain},`;
        });
        sql = sql.slice(0, -1);
    }
    sql += "}', '{";
    if (representing_defendants.length != 0) {
        representing_defendants.forEach((rep_def) => {
            sql += `${rep_def},`;
        });
        
        sql = sql.slice(0, -1);
    }
    sql += "}', '{";
    filings.forEach((filing) => {
        sql += `"${filing}",`;
    });
    sql = sql.slice(0, -1);
    sql += "}');";

    await pool.query(sql);
}

// USER SPECIFIC CALLS

export async function insertUser(discord_id: string, roblox_id: number, permission: number) {
    // Make sure that there isn't already a user with the discord id.
    let check_sql = `SELECT EXISTS ( SELECT 1 FROM users WHERE roblox_id = ${roblox_id});`;
    const check_result = await pool.query(check_sql);

    if (!check_result.rows[0].exists) {
        let sql = `INSERT INTO users (discord_id, roblox_id, permission, created) VALUES (${discord_id}, ${roblox_id}, ${permission}, CURRENT_TIMESTAMP);`;
        return await pool.query(sql);
    } else {
        let sql = `UPDATE users SET discord_id=${discord_id}, roblox_id=${roblox_id}, permission=${permission} WHERE roblox_id=${roblox_id};`;
        return await pool.query(sql);
    }
}

export async function getPermissionFromDiscordID(discord_id: string) {
    let sql = `SELECT permission FROM users WHERE discord_id = ${discord_id}`;
    const get_result = await pool.query(sql);

    if (get_result.rowCount != 0) {
        return get_result.rows[0].permission;
    } else {
        throw new Error("Unable to get Permissions");
    }
}

export async function getRobloxIDFromDiscordID(discord_id: string) {
    let sql = `SELECT roblox_id FROM users WHERE discord_id = ${discord_id}`;
    const get_result = await pool.query(sql);

    if (get_result.rowCount != 0) {
        return get_result.rows[0].roblox_id;
    } else {
        throw new Error("Unable to get Roblox ID");
    }
}

export async function getUserFromDiscordID(discord_id: string) {
    let sql = `SELECT discord_id, roblox_id, permission FROM users WHERE discord_id = ${discord_id}`;
    const result = await pool.query(sql);

    if (result.rowCount) {
        return result.rows[0];
    } else {
        return null;
    }
}
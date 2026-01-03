import { DatabaseClient } from "../client";
import { assert_allowed_type, assert_identifier } from "../sql";


export interface Column {
    name: string,
    type: string,
};

export async function db_create_table(db: DatabaseClient, name: string, column_data: Column[], primary_keys?: string[],) {
    assert_identifier(name);
    let sql = `CREATE TABLE IF NOT EXISTS "${name.toLowerCase()}" (`;
    column_data.forEach((column) => {
        assert_identifier(column.name);
        assert_allowed_type(column.type);
        sql += `"${column.name.toLowerCase()}" ${column.type},`
    });

    if (primary_keys && primary_keys.length > 0) {
        const pkCols = primary_keys.map(c => `"${c.toLowerCase()}"`)
            .join(", ");
        sql += `PRIMARY KEY(${pkCols}),`;
    }
    
    sql = sql.replace(/,$/,"");
    sql += ');';
    return await db.query(sql);
}
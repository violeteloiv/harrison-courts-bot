import dotenv from "dotenv";

dotenv.config();

// DISCORD TOKEN RELATED SHENANIGANS
const { DISCORD_TOKEN, DISCORD_CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
    throw new Error("Missing environment variables");
}

export const config = {
    DISCORD_TOKEN,
    DISCORD_CLIENT_ID,
};

// DISCORD ROLE IDS
export const COURT_REGISTERED_ROLE_ID = "1140761936909320293"; // Discord role to assign

// DISCORD SERVER IDS
export const COURTS_SERVER_ID = "967957262297624597";

// ROBLOX GROUP IDS
export const DA_GROUP_ID = 32985413;
export const COURTS_GROUP_ID = 32305960;
export const MAIN_GROUP_ID = 15665829;

// DOCUMENT IDS
export const ASSIGNMENT_TEMPLATE_ID = "1DBPAfDLCE43aBXcr5IgEfrmbi95FGNs45pZLMNmd7Cg";
export const NOA_TEMPLATE_ID = "1PaWRGt2VzWqWOB0yMEyMgUn5c7EpokRge7MB_-oLoeM";
export const REASSIGNMENT_TEMPLATE_ID = "1yfzR9WVyeEM4RHnwlxBZQjlWUD5bna4CsFvSSeTYeq8";

// FOLDER IDS
export const OATH_FOLDER_ID = "15-YcNJ9ES-FJVOWAFxS8vED7v03qoi7b";

// SHEET IDS
export const BAR_DATABASE_SPREADSHEET_ID = "1y6vbtjiGc4hlWY2PpNTlCHwXRNh07ZchgPz-qgS6dDE";
export const BAR_DATABASE_RANGE = "'License Register'!B7:G47";

// TRELLO IDS
export const COUNTY_COURT_BOARD_ID = "68929e8db5fe44776b435721";
export const B1_COURT_BOARD_ID = "6894fe1a2f9d065ea8300f12";
export const B1_JUDICIAL_OATH_LIST_ID = "68a530c53b2f7fa524f67390";
export const B1_LEGISLATIVE_OATH_LIST_ID = "68a530cb54c7206692d67ef4";
export const B1_EXECUTIVE_OATH_LIST_ID = "68a530c9194557185f458359";
export const B1_OTHER_OATH_LIST_ID = "68a530cd49da0c08744ef6cf";
export const AWAITING_ARCHIVING_COUNTY_LIST_ID = "6892a37a0cf6d3d722bc6bec";

// COLOR CONFIGURATION
export const BOT_SUCCESS_COLOR = "#9853b5";
export const BOT_ERROR_COLOR = "#d93a3a";
export const BOT_DEBUG_COLOR = "#6cb270";
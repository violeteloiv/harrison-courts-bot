import dotenv from "dotenv";

dotenv.config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
    throw new Error("Missing environment variables");
}

export const config = {
    DISCORD_TOKEN,
    DISCORD_CLIENT_ID,
};

export const permissions_list = {
    RESIDENT:           0b00000001,
    ATTORNEY:           0b00000010,
    PROSECUTOR:         0b00000100,
    COUNTY_JUDGE:       0b00001000,
    DEPUTY_CLERK:       0b00010000,
    CIRCUIT_JUDGE:      0b00100000,
    CHIEF_CLERK:        0b01000000,
    ADMINISTRATOR:      0b10000000,

    JUDGE_PLUS:         0b11111000,
    ATTORNEY_PLUS:      0b11111110,

    JUDGE:              0b00101000,
    CLERK:              0b01010000,
};
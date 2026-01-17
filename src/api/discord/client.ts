import { Client } from "discord.js";

/**
 * The discord client which we interface through. Specified the 
 * Guilds, GuildMessages, and DirectMessages intents.
 */
export const client = new Client({
    intents: ["Guilds", "GuildMessages", "DirectMessages"],
});

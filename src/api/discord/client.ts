import { Client } from "discord.js";

/**
 * The discord client which we interface through. Specified the 
 * Guilds, GuildMessages, DirectMessages, and MessageContent intents.
 */
export const client = new Client({
    intents: ["Guilds", "GuildMessages", "DirectMessages", "MessageContent"],
});

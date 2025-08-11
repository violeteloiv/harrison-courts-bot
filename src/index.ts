import { config } from "./config";
import { commands } from "./commands";
import { deployCommands } from "./deploy-commands";
import { verifyConnection } from "./database/db";
import { createTable } from "./database/db_api";
import { client } from "./client";

client.once("ready", async () => {
    console.log("Discord bot is ready! 🤖");

    // Verify the connection to the database.
    verifyConnection();

    // Create the tables.
    await createTable("users", [
        { name: "discord_id", type: "BIGINT" },
        { name: "roblox_id", type: "BIGINT" },
        { name: "permission", type: "SMALLINT" },
        { name: "created", type: "timestamp" },
    ]);

    await createTable("case_codes", [
        { name: "civil", type: "INT" },
        { name: "criminal", type: "INT" },
        { name: "expungement", type: "INT" },
        { name: "special", type: "INT" },
        { name: "appeal", type: "INT" },
        { name: "admin", type: "INT" },
        { name: "duty_court", type: "INT" },
    ]);

    await createTable("cases", [
        { name: "case_code", type: "VARCHAR(16)" },
        { name: "judge", type: "BIGINT" },
        { name: "card_link", type: "VARCHAR(128)" },
        { name: "channel", type: "BIGINT" },
        { name: "status", type: "VARCHAR(16)" },
        { name: "sealed", type: "BOOLEAN" },
        { name: "plaintiffs", type: "BIGINT[10]" },
        { name: "defendants", type: "BIGINT[10]" },
        { name: "representing_plaintiffs", type: "BIGINT[10]" },
        { name: "representing_defendants", type: "BIGINT[10]" },
        { name: "filings", type: "VARCHAR(16)[64]" },
    ]);

    await createTable("filings", [
        { name: "filing_id", type: "VARCHAR(16)" },
        { name: "case_id", type: "VARCHAR(16)" },
        { name: "party", type: "VARCHAR(16)" },
        { name: "filed_by", type: "BIGINT" },
        { name: "types", type: "VARCHAR(32)[5]" },
        { name: "documents", type: "VARCHAR(128)[5]" },
        { name: "date", type: "timestamp" },
    ]);

    // Deploy commands.
    for (const guild of client.guilds.cache.values()) {
        await deployCommands({ guildId: guild.id });
    }
});

client.on("guildCreate", async (guild) => {
    await deployCommands({ guildId: guild.id });
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) {
        return;
    }
    const { commandName } = interaction;
    if (commands[commandName as keyof typeof commands]) {
        commands[commandName as keyof typeof commands].execute(interaction);
    }
});

client.login(config.DISCORD_TOKEN);
import { config } from "./config";
import { commands } from "./commands";
import { deployCommands } from "./deploy-commands";
import { client } from "./api/discord/client";
import { db_verify_connection } from "./api/db/pool";
import { db_run_migrations } from "./api/db/migrate";
import { DatabaseClient } from "./api/db/client";

client.once("ready", async () => {
    // Verify the connection to the database.
    db_verify_connection();
    const db = new DatabaseClient();
    db_run_migrations(db);

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
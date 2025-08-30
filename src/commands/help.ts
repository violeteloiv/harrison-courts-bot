import { EmbedBuilder } from "@discordjs/builders";
import { CommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Gives you a list of commands and their purposes.");

export async function execute(interaction: CommandInteraction) {
    const embed = new EmbedBuilder()
        .setTitle("Command List")
        .setColor(0x9853b5)
        .setTimestamp();

    let description = "\n**General Commands:**\n";
    description += "/register `user?: User`\n";
    description += "- `user` is an optional parameter which allows you to manually register a member of the discord. You must be a **Justice of the Peace+** to use this parameter.\n";
    description += "- Updates you---or another user if specified---in the bot's database. It assigns you permissions based on group ranks.\n";

    description += "\n**Case Commands:**\n";
    description += "/filecase `type: string`\n";
    description += "- `type` is a required parameter for specifying if this is a *civil*, *criminal*, *expungement*, *special*, *appeal*, or *admin* filing.\n";
    description += "- In order to run with type *criminal*, you must be a **Prosecutor**.\n";
    description += "- Running this command will trigger a form in your DMs which you should try to fill out to the best of your ability.\n";
    description += "/noa `case_code: string`, `party: string`\n";
    description += "- `case_code` is a required parameter for specifying the case you are trying to give notice for.\n";
    description += "- `party` is a required parameter for specifying which party you are appearing for.\n";
    description += "- This command will give you permission to speak in the case channel. This can only be run by an **Attorney**, and improper usage can result in sanctions.\n";
    description += "/transferpetition\n";
    description += "- This command prompts the user with a form in their DMs to fill out with the purpose of playing for transfer of bar certification.\n";

    description += "\n**Administrative Commands:**\n";
    description += "/pendingcases\n";
    description += "- Will give the user a list of cases which are currently pending before the court. This can only be run by **Clerks** or above.\n";
    description += "/assigncase `case_code: string`, `judge: User`\n";
    description += "- `case_code` is a required parameter for specifying the case you wish to assign a judge to.\n";
    description += "- `judge` is a required parameter for specifying the judge you wish to assign the case to.\n";
    description += "- This command will assign the case to the specified judge. This can only be run by **Clerks** or above.\n";

    embed.setDescription(description);

    return await interaction.reply({ embeds: [embed] });
}
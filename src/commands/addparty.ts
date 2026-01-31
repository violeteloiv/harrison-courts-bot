import { ChatInputCommandInteraction, CommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import noblox from "noblox.js";

import { fetch_guild_member_and_nickname } from "../api/discord/guild";
import { DatabaseClient } from "../api/db/client";
import { CaseRole, CasesRepository } from "../api/db/repos/cases";
import { build_embed, create_error_embed } from "../api/discord/visual";
import { UsersRepository } from "../api/db/repos/users";
import { permissions_list } from "../api/permissions";

const db = new DatabaseClient();
const cases_repo = new CasesRepository(db);
const users_repo = new UsersRepository(db);

export const data = new SlashCommandBuilder()
    .setName("addparty")
    .addUserOption(option =>
        option
            .setName("user")
            .setDescription("The user you are adding")
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName("party")
            .setDescription("The party you are adding to.")
            .setChoices([
                { name: "Plaintiff", value: "plaintiff" },
                { name: "Defendant", value: "defendant" },
            ])
            .setRequired(true)
    )
    .addUserOption(option =>
        option
            .setName("organization")
            .setDescription("The organization that the user is representing, if applicable")
            .setRequired(false)
    )
    .setDescription("Adds a party to your case if they are in the discord! [Clerk+].");

export async function execute(interaction: CommandInteraction) {
    await interaction.reply({ embeds: [build_embed("Processing", "Processing your request.")] });
    const input_interaction = interaction as ChatInputCommandInteraction;

    let input_discord_user = input_interaction.options.getUser("user", true);
    let input_party = input_interaction.options.getString("party", true);
    let input_org = input_interaction.options.getString("organization", false);

    // Check if this is being run in a case channel
    let court_case = await cases_repo.find_one("channel = $1", [interaction.channelId]);
    if (!court_case)
        return await interaction.editReply({ embeds: [create_error_embed("Info Error", "You must run this command within a case channel.")] });

    // Check if this is being run by a judge
    let username = (await fetch_guild_member_and_nickname(input_interaction, interaction.user)).nickname;
    let roblox_id = await noblox.getIdFromUsername(username);
    let interaction_user = await users_repo.get_by_id(roblox_id);
    if (!interaction_user)
        return await interaction.editReply({ embeds: [create_error_embed("User Error", "You must run /register before running other commands.")] });
    if ((interaction_user.permission & permissions_list.JUDGE) === 0 && (interaction_user.permission & permissions_list.ADMINISTRATOR) === 0
        && (interaction_user.permission & permissions_list.CLERK) === 0)
        return await interaction.editReply({ embeds: [create_error_embed("User Error", "You must be a Judge to run this command.")] });

    // Check if the adding party is registered, if not add them
    let adding_username = (await fetch_guild_member_and_nickname(input_interaction, input_discord_user)).nickname;
    let adding_roblox_id = await noblox.getIdFromUsername(adding_username);
    let adding_user = await users_repo.get_by_id(adding_roblox_id);
    if (!adding_user) await users_repo.upsert({ discord_id: input_discord_user.id, roblox_id: String(adding_roblox_id), permission: 0 });

    // Check if they are already a party to the proceeding
    let plaintiffs = await cases_repo.get_party_names_by_role(court_case.case_code, "plaintiff");
    let defendants = await cases_repo.get_party_names_by_role(court_case.case_code, "defendant");
    let parties = [...plaintiffs, ...defendants];
    if (!parties.includes(adding_username)) {
        // If not, add them to the proceeding database
        if (input_org) {
            await cases_repo.add_party(court_case, { user_id: "", role: input_party as CaseRole, organization: input_org });
        } else {
            await cases_repo.add_party(court_case, { user_id: "", role: input_party as CaseRole, organization: "" });
        }
    } else {
        return await interaction.editReply({ embeds: [build_embed("Processed!", `The user <@${input_discord_user.id}> is already a party to the case.`)] });
    }

    // Update the permissions of the channel so the user can speak
    let channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.edit(input_discord_user.id, {
        ViewChannel: true,
        SendMessages: true,
    });

    return await interaction.editReply({ embeds: [build_embed("Processed!", `The user <@${input_discord_user.id}> has been added as a ${input_party}.`)] });
}

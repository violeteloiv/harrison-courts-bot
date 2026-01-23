import { CategoryChannel, ChannelType, ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, GuildChannel, PermissionFlagsBits, SlashCommandBuilder, User } from "discord.js";
import noblox from "noblox.js";

import { DatabaseClient } from "../api/db/client";
import { CasesRepository } from "../api/db/repos/cases";
import { FilingRepository } from "../api/db/repos/filings";
import { UsersRepository, User as DBUser } from "../api/db/repos/users";
import { create_error_embed } from "../api/discord/visual";
import { create_and_store_assignment, create_and_store_reassignment } from "../api/google/documents";
import { permissions_list } from "../api/permissions";
import { get_by_short_link, update_card } from "../api/trello/card";
import { move_card_to_list_by_name } from "../api/trello/list";
import { get_trello_due_date, normalize_card_id } from "../api/trello/service";

import { get_unique_filing_id, long_month_date_format, update_filing_record } from "../helper/format";
import { BOT_SUCCESS_COLOR } from "../config";

const COUNTY_COURT_BOARD_ID = "68929e8db5fe44776b435721";
const CIRCUIT_COURT_BOARD_ID = "6892a4c496df6092610ed5db";

let db = new DatabaseClient();
let cases_repo = new CasesRepository(db);
let users_repo = new UsersRepository(db);
let filings_repo = new FilingRepository(db);

export const data = new SlashCommandBuilder()
    .setName("assigncase")
    .addStringOption(option =>
        option
            .setName("case_id")
            .setDescription("The id of the case")
            .setRequired(true)
    )
    .addUserOption(option =>
        option 
            .setName("judge")
            .setDescription("The judge you are assigning the case to")
            .setRequired(true)
    )
    .setDescription("Assigns a currently pending case to a judge [Clerk+].");

async function verify_inputs(interaction: CommandInteraction, case_id: string, judge_user: User) {
    // Ensure the case id is of the right form.
    if (!case_id.match(/(H)(CV|CR|SP|EX|AP|AD)-([0-9]{4})-([0-9]{2})/)) {
        return await interaction.editReply({ embeds: [create_error_embed("Parameter Error", "Must submit something of the form HXX-XXXX-XX.")] });
    }

    // Check if a case exists with the supplied code.
    let court_case;
    try {
        court_case = await cases_repo.get_by_id(case_id);
        if (court_case) {
            if (court_case.status == "closed") {
                return await interaction.editReply({ embeds: [create_error_embed("Parameter Error", "Case Code supplied belongs to a case which is closed.")] });
            }
        } else {
            return await interaction.editReply({ embeds: [create_error_embed("Parameter Error", "Case Code supplied does not belong to any case in our database.")] });
        }
    } catch (error) {
        return await interaction.editReply({ embeds: [create_error_embed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }

    // Check if the user is a judge.
    let user: DBUser | null;
    try {
        user = await users_repo.get_by_discord_id(judge_user.id);
        if (user && user!.discord_id !== "0") {
            if ((user!.permission & permissions_list.JUDGE) == 0) {
                return await interaction.editReply({ embeds: [create_error_embed("Parameter Error", "User specified is not a judge in the database.")] });
            }
        } else {
            return await interaction.editReply({ embeds: [create_error_embed("Parameter Error", "User specified is not registered in the database.")] });
        }
    } catch (error) {
        return await interaction.editReply({ embeds: [create_error_embed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }
}

export async function execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    // Check the permissions of the user.
    let user = await users_repo.get_by_discord_id(interaction.user.id);
    if (!user) return await interaction.editReply({ embeds: [create_error_embed("Submission Error", "Please run the /register command to use any commands under this bot.")] });

    let permission = user.permission;
    if ((permission & permissions_list.CLERK) == 0 && (permission & permissions_list.ADMINISTRATOR) == 0)
        return await interaction.editReply({ embeds: [create_error_embed("Permission Error", "Must be a judge or clerk to run this command.")] });

    const chatInteraction = interaction as ChatInputCommandInteraction;
    let case_id = chatInteraction.options.getString("case_id", true);
    let judge_user = chatInteraction.options.getUser("judge", true);

    if (await verify_inputs(interaction, case_id, judge_user)) return;

    const processing_embed = new EmbedBuilder()
        .setTitle("Processing Request")
        .setDescription("Processing Request")
        .setColor(BOT_SUCCESS_COLOR)
        .setTimestamp();
    
    await interaction.editReply({ embeds: [processing_embed] });

    try {
        let court_case = await cases_repo.get_by_id(case_id);
        if (!court_case) return;

        // Update the case in the database.
        let judge_db_user = await users_repo.get_by_discord_id(judge_user.id);

        await cases_repo.update(case_id, { judge: judge_db_user?.roblox_id });
        let judge_nickname = (await interaction.guild!.members.fetch(judge_user.id)).nickname;
        let clerk_nickname = (await interaction.guild!.members.fetch(interaction.user!.id)).nickname;

        processing_embed.setDescription("Updating the Trello Card.")
        await interaction.editReply({ embeds: [processing_embed] });

        // Update the trello card.
        let card = await get_by_short_link(normalize_card_id(court_case.card_link));
        card.description = card.description.replace(/(\*\*Presiding Judge:\*\*\s*)(.+)/, `$1${judge_nickname}`);
        card.description = card.description.replace(/(\*\*Date Assigned:\*\*\s*)(.+)/, `$1${long_month_date_format(new Date())}`);
        card.deadline = get_trello_due_date(3);
        
        let case_type = court_case.case_code;
        let jurisdiction;
        if (case_type == "appeal" || case_type == "admin") {
            jurisdiction = "SEVENTH JUDICIAL CIRCUIT COURT";
        } else {
            jurisdiction = "COUNTY COURT";
        }

        let db_user = await users_repo.get_by_discord_id(interaction.user!.id);

        if (court_case.status == "pending") {
            card.labels = [];
            if (card.boardId == COUNTY_COURT_BOARD_ID) {
                card.labels.push({
                    id: "68929e8db5fe44776b435764", name: "PRE-TRIAL"
                });
                await cases_repo.update(case_id, { status: "open" });
            } else {
                card.labels.push({
                    id: "689a6a1749d97535aca1b04e", name: "CONSIDERATION"
                });
                await cases_repo.update(case_id, { status: "open" });
            }

            let plaintiffs = court_case.parties?.filter(party => party.role === "plaintiff").map(party => party.user_id)!;
            let plaintiff_names = [];
            for (const plaintiff of plaintiffs) {
                plaintiff_names.push(await noblox.getUsernameFromId(Number(plaintiff)));
            }

            let defendants = court_case.parties?.filter(party => party.role === "defendant").map(party => party.user_id)!;
            let defendant_names = [];
            for (const defendant of defendants) {
                defendant_names.push(await noblox.getUsernameFromId(Number(defendant)));
            }

            let assignment = await create_and_store_assignment(
                { case_code: case_id, plaintiffs: plaintiff_names, defendants: defendant_names, presiding_judge: judge_nickname!, jurisdiction: jurisdiction, username: clerk_nickname! }
            )

            processing_embed.setDescription("Creating and Storing the Assignment.")
            await interaction.editReply({ embeds: [processing_embed] });

            // Create the filing for assignment of a Judge
            let filing_id = await get_unique_filing_id();
            await filings_repo.upsert({ filing_id: filing_id, case_code: case_id, party: "Court",  filed_by: db_user?.roblox_id!, types: [{ type: "Assignment"}], documents: [{doc_link: assignment}] });
            card.description = update_filing_record(card.description, ["Assignment"], [assignment], clerk_nickname!);
        } else {
            let case_type_arr = ["CIVIL", "CRIMINAL", "EXPUNGEMENT", "SPECIAL", "APPEAL", "ADMIN"];
            card.labels = card.labels.filter(label => !case_type_arr.includes(label.name));

            let plaintiffs = court_case.parties?.filter(party => party.role === "plaintiff").map(party => party.user_id)!;
            let plaintiff_names = [];
            for (const plaintiff of plaintiffs) {
                plaintiff_names.push(await noblox.getUsernameFromId(Number(plaintiff)));
            }

            let defendants = court_case.parties?.filter(party => party.role === "defendant").map(party => party.user_id)!;
            let defendant_names = [];
            for (const defendant of defendants) {
                defendant_names.push(await noblox.getUsernameFromId(Number(defendant)));
            }

            let reassignment = await create_and_store_reassignment(
                { case_code: case_id, plaintiffs: plaintiff_names, defendants: defendant_names, presiding_judge: judge_nickname!, jurisdiction: jurisdiction, username: clerk_nickname! }
            )

            processing_embed.setDescription("Creating and Storing the Reassignment.")
            await interaction.editReply({ embeds: [processing_embed] });

            // Create the filing for reassignment of a Judge
            let filing_id = await get_unique_filing_id();
            await filings_repo.upsert({ filing_id: filing_id, case_code: case_id, party: "Court",  filed_by: db_user?.roblox_id!, types: [{ type: "Reassignment"}], documents: [{doc_link: reassignment}] });
            card.description = update_filing_record(card.description, ["Reassignment"], [reassignment], clerk_nickname!);
        }
        
        await update_card(card);
        if (case_type == "appeal" || case_type == "admin") {
            await move_card_to_list_by_name(card.id, "Docket");
        } else {
            await move_card_to_list_by_name(card.id, `Docket of ${judge_nickname}`);
        }

        processing_embed.setDescription("Trello Card Updated, Creating the Channel.")
            await interaction.editReply({ embeds: [processing_embed] });

        // Create the case channel in the relevant category.
        if (court_case.status == "pending") {
            let category;

            let perm_overwrites = [
                {
                    id: interaction.guild!.roles.everyone.id,
                        deny: [
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.CreatePrivateThreads,
                            PermissionFlagsBits.CreatePublicThreads,
                            PermissionFlagsBits.SendMessages
                        ],
                        allow: [
                            PermissionFlagsBits.ViewChannel
                        ]
                },
                {
                    id: interaction.guild!.roles.cache.find(role => role.name == "Deputy Clerk")!.id,
                    allow: [
                        PermissionFlagsBits.SendMessages
                    ]
                },
                {
                    id: interaction.guild!.roles.cache.find(role => role.name == "Registrar")!.id,
                    allow: [
                        PermissionFlagsBits.SendMessages
                    ]
                },
                {
                    id: interaction.guild!.roles.cache.find(role => role.name == "Chief Judge")!.id,
                    allow: [
                        PermissionFlagsBits.SendMessages
                    ]
                },  
            ]

            if (case_type == "appeal" || case_type == "admin") {
                category = interaction.guild!.channels.cache.find(
                    channel => channel.name == `Circuit Court` && channel.type == ChannelType.GuildCategory
                ) as CategoryChannel;

                perm_overwrites.push({
                    id: interaction.guild!.roles.cache.find(role => role.name == "Circuit Judge")!.id,
                    allow: [
                        PermissionFlagsBits.SendMessages
                    ]
                });
            } else {
                category = interaction.guild!.channels.cache.find(
                    channel => channel.name == `Chambers of ${judge_nickname}` && channel.type == ChannelType.GuildCategory
                ) as CategoryChannel;

                perm_overwrites.push({
                    id: judge_user.id,
                    allow: [
                        PermissionFlagsBits.SendMessages
                    ]
                });
            }

            let channel = await interaction.guild!.channels.create({
                name: `${card.name}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: perm_overwrites
            });
            
            await cases_repo.update(case_id, { channel: channel.id });

            channel.send(`<@${judge_user.id}>, you have been assigned: ${court_case.card_link}`);
        } else {
            processing_embed.setDescription("Moving the original case channel.")
            await interaction.editReply({ embeds: [processing_embed] });

            // Move the channel to the new category.
            let channel = interaction.guild!.channels.cache.find(channel => channel.id == court_case.channel) as GuildChannel;
            channel.permissionOverwrites.edit(judge_user.id, {
                SendMessages: true,
            })
            let category = interaction.guild!.channels.cache.find(
                channel => channel.name == `Chambers of ${judge_nickname}` && channel.type == ChannelType.GuildCategory
            ) as CategoryChannel;
            channel.setParent(category.id, { lockPermissions: false });

            if (channel.isTextBased()) {
                channel.send(`<@${judge_user.id}>, you have been reassigned to this case: ${court_case.card_link}`);
            }
        }

        processing_embed.setDescription("Successfully Assigned/Reassigned the Case!");
        await interaction.editReply({ embeds: [processing_embed] });
    } catch (error) {
        return await interaction.editReply({ embeds: [create_error_embed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }
}
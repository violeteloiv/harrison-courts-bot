import { CategoryChannel, ChannelType, ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, GuildChannel, PermissionFlagsBits, SlashCommandBuilder, TextBasedChannel, User } from "discord.js";
import { createErrorEmbed, getCaseTypeFromCaseCode, getUniqueFilingID, longMonthDayYearFormat, updateFilingRecord } from "../helper/format";
import { getCaseByCaseCode, getPermissionFromDiscordID, getUserFromDiscordID, insertFiling, updateChannelUsingCaseCode, updateJudgeUsingCaseCode, updateStatusUsingCaseCode } from "../api/db_api";
import { permissions_list } from "../config";
import { getCardFromLink, getTrelloDueDate, moveCaseCardToCategory, updateTrelloCard } from "../api/trello_api";
import { createAndStoreAssignment } from "../api/documents/assignment";
import { createAndStoreReassignment } from "../api/documents/reassignment";

const COUNTY_COURT_BOARD_ID = "68929e8db5fe44776b435721";
const CIRCUIT_COURT_BOARD_ID = "6892a4c496df6092610ed5db";

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
        return await interaction.editReply({ embeds: [createErrorEmbed("Parameter Error", "Must submit something of the form HXX-XXXX-XX.")] });
    }

    // Check if a case exists with the supplied code.
    let court_case;
    try {
        court_case = await getCaseByCaseCode(case_id);
        if (court_case) {
            if (court_case.status == "closed") {
                return await interaction.editReply({ embeds: [createErrorEmbed("Parameter Error", "Case Code supplied belongs to a case which is closed.")] });
            }
        } else {
            return await interaction.editReply({ embeds: [createErrorEmbed("Parameter Error", "Case Code supplied does not belong to any case in our database.")] });
        }
    } catch (error) {
        return await interaction.editReply({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }

    // Check if the user is a judge.
    let user;
    try {
        user = await getUserFromDiscordID(judge_user.id);
        if (user) {
            if ((user.permission & permissions_list.JUDGE) == 0) {
                return await interaction.editReply({ embeds: [createErrorEmbed("Parameter Error", "User specified is not a judge in the database.")] });
            }
        } else {
            return await interaction.editReply({ embeds: [createErrorEmbed("Parameter Error", "User specified is not registered in the database.")] });
        }
    } catch (error) {
        return await interaction.editReply({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }
}

export async function execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    // Check the permissions of the user.
    let permission = await getPermissionFromDiscordID(interaction.user.id);
    if ((permission & permissions_list.CLERK) == 0 && (permission & permissions_list.ADMINISTRATOR) == 0) {
        return await interaction.editReply({ embeds: [createErrorEmbed("Permission Error", "Must be a judge or clerk to run this command.")] });
    }

    const chatInteraction = interaction as ChatInputCommandInteraction;
    let case_id = chatInteraction.options.getString("case_id", true);
    let judge_user = chatInteraction.options.getUser("judge", true);

    if (await verify_inputs(interaction, case_id, judge_user)) return;

    const processing_embed = new EmbedBuilder()
        .setTitle("Processing Request")
        .setDescription("Processing Request")
        .setColor("#9853b5")
        .setTimestamp();
    
    await interaction.editReply({ embeds: [processing_embed] });

    try {
        let court_case = await getCaseByCaseCode(case_id);

        // Update the case in the database.
        await updateJudgeUsingCaseCode(case_id, judge_user.id);
        let judge_nickname = (await interaction.guild!.members.fetch(judge_user.id)).nickname;
        let clerk_nickname = (await interaction.guild!.members.fetch(interaction.user!.id)).nickname;

        processing_embed.setDescription("Updating the Trello Card.")
        await interaction.editReply({ embeds: [processing_embed] });

        // Update the trello card.
        let card = await getCardFromLink(court_case.card_link);
        card.description = card.description.replace(/(\*\*Presiding Judge:\*\*\s*)(.+)/, `$1${judge_nickname}`);
        card.description = card.description.replace(/(\*\*Date Assigned:\*\*\s*)(.+)/, `$1${longMonthDayYearFormat(new Date())}`);
        card.deadline = getTrelloDueDate(3);
        
        let case_type = getCaseTypeFromCaseCode(case_id);
        let jurisdiction;
        if (case_type == "appeal" || case_type == "admin") {
            jurisdiction = "SEVENTH JUDICIAL CIRCUIT COURT";
        } else {
            jurisdiction = "COUNTY COURT";
        }

        if (court_case.status == "pending") {
            card.labels = [];
            if (card.boardId == COUNTY_COURT_BOARD_ID) {
                card.labels.push({
                    id: "68929e8db5fe44776b435764", name: "PRE-TRIAL"
                });
                await updateStatusUsingCaseCode(case_id, "pre-trial");
            } else {
                card.labels.push({
                    id: "689a6a1749d97535aca1b04e", name: "CONSIDERATION"
                });
                await updateStatusUsingCaseCode(case_id, "consideration");
            }

            let assignment = await createAndStoreAssignment(
                { case_id: case_id, plaintiffs: court_case.plaintiffs, defendants: court_case.defendants, presiding_judge: judge_nickname!, jurisdiction: jurisdiction, username: clerk_nickname! }
            )

            processing_embed.setDescription("Creating and Storing the Assignment.")
            await interaction.editReply({ embeds: [processing_embed] });

            // Create the filing for assignment of a Judge
            let filing_id = await getUniqueFilingID();
            await insertFiling(filing_id, case_id, "Court", interaction.user!.id, ["Assignment"], [assignment]);
            card.description = updateFilingRecord(card.description, ["Assignment"], [assignment], clerk_nickname!);
        } else {
            let case_type_arr = ["CIVIL", "CRIMINAL", "EXPUNGEMENT", "SPECIAL", "APPEAL", "ADMIN"];
            card.labels = card.labels.filter(label => !case_type_arr.includes(label.name));

            let reassignment = await createAndStoreReassignment(
                { case_id: case_id, plaintiffs: court_case.plaintiffs, defendants: court_case.defendants, presiding_judge: judge_nickname!, jurisdiction: jurisdiction, username: clerk_nickname! }
            )

            processing_embed.setDescription("Creating and Storing the Reassignment.")
            await interaction.editReply({ embeds: [processing_embed] });

            // Create the filing for reassignment of a Judge
            let filing_id = await getUniqueFilingID();
            await insertFiling(filing_id, case_id, "Court", interaction.user!.id, ["Reassignment"], [reassignment]);
            card.description = updateFilingRecord(card.description, ["Reassignment"], [reassignment], clerk_nickname!);
        }
        
        await updateTrelloCard(card, case_type);
        if (case_type == "appeal" || case_type == "admin") {
            await moveCaseCardToCategory(card, "Docket");
        } else {
            await moveCaseCardToCategory(card, `Docket of ${judge_nickname}`);
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
                    id: interaction.guild!.roles.cache.find(role => role.name == "Chief Clerk")!.id,
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
            
            await updateChannelUsingCaseCode(case_id, channel.id);

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
        return await interaction.editReply({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }
}
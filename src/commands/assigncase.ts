import { CategoryChannel, ChannelType, ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, User } from "discord.js";
import { createErrorEmbed, getCaseTypeFromCaseCode, longMonthDayYearFormat } from "../helper/format";
import { getCaseByCaseCode, getPermissionFromDiscordID, getUserFromDiscordID, updateJudgeUsingCaseCode, updateStatusUsingCaseCode } from "../api/db_api";
import { permissions_list } from "../config";
import { getCardFromLink, getTrelloDueDate, moveCaseCardToCategory, updateTrelloCard } from "../api/trello_api";

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
    interaction.deferReply({ ephemeral: true });

    // Check the permissions of the user.
    let permission = await getPermissionFromDiscordID(interaction.user.id);
    if ((permission & permissions_list.CLERK) == 0 && (permission & permissions_list.ADMINISTRATOR) == 0) {
        return await interaction.followUp({ embeds: [createErrorEmbed("Permission Error", "Must be a judge or clerk to run this command.")] });
    }

    const chatInteraction = interaction as ChatInputCommandInteraction;
    let case_id = chatInteraction.options.getString("case_id", true);
    let judge_user = chatInteraction.options.getUser("judge", true);

    if (await verify_inputs(interaction, case_id, judge_user)) return;

    try {
        // Update the case in the database.
        await updateJudgeUsingCaseCode(case_id, judge_user.id);
        let court_case = await getCaseByCaseCode(case_id);
        let judge_nickname = (await interaction.guild!.members.fetch(judge_user.id)).nickname

        // Update the trello card.
        let card = await getCardFromLink(court_case.card_link);
        card.description = card.description.replace(/(\*\*Presiding Judge:\*\*\s*)(.+)/, `$1${judge_nickname}`);
        card.description = card.description.replace(/(\*\*Date Assigned:\*\*\s*)(.+)/, `$1${longMonthDayYearFormat(new Date())}`);
        card.deadline = getTrelloDueDate(3);
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

        let case_type = getCaseTypeFromCaseCode(case_id);
        await updateTrelloCard(card, case_type);
        if (case_type == "appeal" || case_type == "admin") {
            await moveCaseCardToCategory(card, "Docket");
        } else {
            await moveCaseCardToCategory(card, `Docket of ${judge_nickname}`);
        }

        // Create the case channel in the relevant category.
        const category = interaction.guild!.channels.cache.find(
            channel => channel.name == `Chambers of ${judge_nickname}` && channel.type == ChannelType.GuildCategory
        ) as CategoryChannel;

        await interaction.guild!.channels.create({
            name: `${card.name}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
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
                {
                    id: judge_user.id,
                    allow: [
                        PermissionFlagsBits.SendMessages
                    ]
                }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle("Success!")
            .setDescription(`Assigned the case!`)
            .setColor("#9853b5")
            .setTimestamp();

        return await interaction.followUp({ embeds: [embed], ephemeral: false });
    } catch (error) {
        return await interaction.followUp({ embeds: [createErrorEmbed("Bot Error", `Message <@344666620419112963> with this error:\n${error}`)] });
    }
}
import { ChatInputCommandInteraction, CommandInteraction, Message, SlashCommandBuilder, TextChannel } from "discord.js";

import { DatabaseClient } from "../api/db/client";
import { User, UsersRepository } from "../api/db/repos/users";
import { build_embed, create_error_embed } from "../api/discord/visual";
import { buffer_to_stream, download_image, format_data_utc } from "../api/file";
import { upload_stream_to_drive } from "../api/google/drive";
import { permissions_list } from "../api/permissions";
import { user_has_rank } from "../api/roblox";
import { create_card } from "../api/trello/card";
import { trello_fetch } from "../api/trello/client";

import { B1_EXECUTIVE_OATH_LIST_ID, B1_JUDICIAL_OATH_LIST_ID, B1_LEGISLATIVE_OATH_LIST_ID, COURTS_GROUP_ID, OATH_FOLDER_ID } from "../config";

const db = new DatabaseClient();
const users_repo = new UsersRepository(db);

export const data = new SlashCommandBuilder()
    .setName("oath")
    .addStringOption(option =>
        option
            .setName("username")
            .setDescription("Username of the oath taker.")
            .setRequired(true)
    )
    .addStringOption(option => 
        option
            .setName("position")
            .setDescription("Position the oath taker is fulfilling.")
            .setRequired(true)
    )
    .setDescription("Inserts a new oath into the system for record keeping [County Judge+ or Authorized]");

export async function execute(interaction: CommandInteraction) {
    const chat_interaction = interaction as ChatInputCommandInteraction;
    await interaction.deferReply();

    // Oath Giver Information
    const guild_member = await interaction.guild?.members.fetch(interaction.user.id); 
    const oath_giver_user: string = guild_member?.nickname || interaction.user.username;
    let res: User | null = await users_repo.get_by_id(interaction.user.id);
    if (!res) return interaction.editReply({ embeds: [ create_error_embed("Bot Error", "Please Register with the Bot using /register") ] });
    let user: User = res;

    // Check if the user is allowed to run the command
    if ((user.permission & permissions_list.JUDGE) === 0 && (user.permission & permissions_list.ADMINISTRATOR) === 0) 
        return interaction.editReply({ embeds: [ create_error_embed("Bot Error", "You are not a Judge in the group.") ] });
    let oath_giver_position: string;
    if (await user_has_rank(Number(user.roblox_id), COURTS_GROUP_ID, "Chief Judge")) oath_giver_position = "Chief Judge";
    if (await user_has_rank(Number(user.roblox_id), COURTS_GROUP_ID, "Administrative Judge")) oath_giver_position = "Administrative Judge";
    if (await user_has_rank(Number(user.roblox_id), COURTS_GROUP_ID, "Circuit Judge")) oath_giver_position = "Circuit Judge";
    if (await user_has_rank(Number(user.roblox_id), COURTS_GROUP_ID, "County Judge")) oath_giver_position = "County Judge";
    oath_giver_position = "Authorized Position";

    // Oath Taker Information
    const oath_taker_username: string = chat_interaction.options.getString("username")!;
    const oath_taker_position: string = chat_interaction.options.getString("position")!;

    // If the oath taker's position is a certain set, the oath giver can submit two photos.
    let max_photos: number = 1;
    if (oath_taker_position.toLowerCase() === "sheriff" || oath_taker_position.toLowerCase() === "district attorney" || oath_taker_position.toLowerCase() === "councilor"
    || oath_taker_position.toLowerCase() === "peace officer" || oath_taker_position.toLowerCase() === "chief judge" || oath_taker_position.toLowerCase() === "county judge"
    || oath_taker_position.toLowerCase() === "justice of the peace" || oath_taker_position.toLowerCase() === "circuit judge" || oath_taker_position.toLowerCase() === "registrar") {
        max_photos = 2;
    }

     // Create the card storing this information in the basement.
    let list_id;
    if (oath_taker_position.toLowerCase() === "sheriff" || oath_taker_position.toLowerCase() === "peace officer")
        list_id = B1_EXECUTIVE_OATH_LIST_ID;
    else if (oath_taker_position.toLowerCase() === "district attorney" || oath_taker_position.toLowerCase() === "chief judge" || oath_taker_position.toLowerCase() === "county judge"
    || oath_taker_position.toLowerCase() === "justice of the peace" || oath_taker_position.toLowerCase() === "circuit judge" || oath_taker_position.toLowerCase() === "registrar")
        list_id = B1_JUDICIAL_OATH_LIST_ID;
    else if (oath_taker_position.toLowerCase() === "councilor")
        list_id = B1_LEGISLATIVE_OATH_LIST_ID;

    if (!list_id)
        return await interaction.followUp({ embeds: [create_error_embed("Invalid Input", `Ensure the position '${oath_taker_position}' requires an oath. If so, contact <@344666620419112963>`)] });

    // Retrieve the screenshots from the attachments.
    const prompt: Message = await interaction.editReply({ embeds: [ build_embed("Next Steps", `Reply to this message with attachments of at most ${max_photos} photos representing the oaths.`) ] });
    const channel = prompt.channel as TextChannel;
    const collector = channel.createMessageCollector({
        filter: (m: Message) =>
            m.author.id === interaction.user.id,
        time: 5 * 60_000,
    });

    let collected_images: string[] = [];

    collector.on("collect", async (reply) => {
        const images = reply.attachments.filter(att =>
            att.contentType?.startsWith("image/")
        );

        if (!images.size) {
            await interaction.followUp({
                embeds: [ create_error_embed("Invalid", "Reply must have Image Attachments.") ]
            });
            return;
        }

        // Store collected images on the google drive in an oaths folder for safe-keeping.
        let i = 1;
        for (const image_url of images.map(img => img.url)) {
            const buffer = await download_image(image_url);
            const stream = buffer_to_stream(buffer);
            const extension = image_url.split(".").pop() || "jpg";
            const mime_type = `image/${extension}`;
            const file = await upload_stream_to_drive(stream, `${oath_taker_username}'s Oath ${i} - ${format_data_utc(new Date())}`, OATH_FOLDER_ID, mime_type);
            collected_images.push(file.webViewLink!);
            i++;
        }

        collector.stop("done");
    });

    collector.on("end", async (_, reason) => {
        if (reason == "time") {
            interaction.followUp({
                embeds: [ create_error_embed("Timeout", "No reply received, please try again.") ]
            });
        }

        if (reason == "done" || reason == "limit") {
            let desc = `**Oath Giver:** ${oath_giver_position} ${oath_giver_user}\n`
                + `**Oath Taker:** ${oath_taker_position} ${oath_taker_username}\n`
                + `**Date:** ${format_data_utc(new Date())}\n`;

            let card = await create_card(list_id!, {
                name: `${oath_taker_username}'s Oath as ${oath_taker_position}`,
                desc: desc,
            });

            for (const image_url of collected_images) {
                const params = new URLSearchParams();
                params.append("url", image_url);
                await trello_fetch(`/cards/${card.id}/attachments?${params.toString()}`, {
                    method: "POST"
                });
            }

            interaction.followUp({
                embeds: [ build_embed("Success!", `Find [here](${card.url}) a link to the relevant trello card.`) ]
            })
        }
    });
}
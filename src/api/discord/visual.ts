import { EmbedBuilder } from "discord.js";
import { BOT_DEBUG_COLOR, BOT_ERROR_COLOR, BOT_SUCCESS_COLOR } from "../../config";

/**
 * Builds an embed for normal messages from the bot.
 * 
 * @param title The title of the embed
 * @param description The description of the embed
 * @returns A normal messages embed
 */
export function build_embed(title: string, description: string) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(BOT_SUCCESS_COLOR)
        .setTimestamp();
}

/**
 * Builds an embed for error messages from the bot.
 * 
 * @param title The title of the embed
 * @param description The description of the embed
 * @returns An error messages embed
 */
export function create_error_embed(title: string, description: string) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(BOT_ERROR_COLOR)
        .setTimestamp();
}

/**
 * Builds an embed for debug messages from the bot.
 * 
 * @param description The debug text
 * @returns A debug messages embed
 */
export function debug_embed(description: string) {
    return new EmbedBuilder()
        .setTitle("DEBUG")
        .setDescription(description)
        .setColor(BOT_DEBUG_COLOR)
}
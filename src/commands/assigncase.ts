import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("assigncase")
    .setDescription("Assigns a currently pending case to a judge [Clerk+].");


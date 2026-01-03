import { CommandInteraction, SlashCommandBuilder } from "discord.js";

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
    .setDescription("Adds a party to your case!.");

export async function execute(interaction: CommandInteraction) {

}
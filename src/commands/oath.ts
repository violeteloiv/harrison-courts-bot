import { CommandInteraction, SlashCommandBuilder } from "discord.js";

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
    // Prerequisites: register commmand, proper forms
    
    // Data:
    // - username of oath giver, rank [received from their permission in the system + nickname]
    // - username of oath taker, rank [received from command input]
    // - screenshot(s) of oath(s) [received from form question]
    // Data Visualization
    // - Information posted on the trello.


}
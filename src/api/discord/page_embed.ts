import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, Interaction, Message } from "discord.js";

const EMBED_DESC_LIMIT = 4096;

export class PaginatedEmbedBuilder {
    private readonly base_embed: EmbedBuilder;
    private pages: string[] = [];
    private current_page_content: string[] = [];

    constructor(base_embed: EmbedBuilder) {
        this.base_embed = base_embed;
    }

    /**
     * Appends text safely, splitting into pages if needed.
     * 
     * @param text The text to append.
     */
    add(text: string): this {
        if (text.length > EMBED_DESC_LIMIT) {
            throw new Error("Line exceeds Discord Embed Limit.");
        }

        const current = this.current_page_content.join("\n");
        if (current.length + text.length > EMBED_DESC_LIMIT) {
            this.flush();
        }
        this.current_page_content.push(text);
        return this;
    }

    /**
     * Creates a new page break.
     */
    new_page(): this {
        this.flush();
        return this;
    }

    /**
     * Builds Discord Embeds with the footer page numbers.
     * 
     * @returns The discord embeds that were built
     */
    build(): EmbedBuilder[] {
        this.flush();

        return this.pages.map((desc, index) =>
            EmbedBuilder.from(this.base_embed)
                .setDescription(desc)
                .setFooter({
                    text: `Page ${index + 1} of ${this.pages.length}`
                })
        );
    }

    /**
     * Sends the paginated embeds to a channel or interaction with button navigation.
     * 
     * @param interaction The interaction to send it to.
     */
    async send(interaction: Interaction) {
        if (!interaction.isCommand() && !interaction.isMessageComponent()) {
            throw new Error("Sending Requires a command or message component");
        }

        const embeds = this.build();
        if (embeds.length === 0) return;

        let current_page = 0;

        const message = await interaction.reply({
            embeds: [embeds[current_page]],
            components: [this.create_buttons()],
            fetchReply: true
        }) as Message;

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 4 * 60_000
        });

        collector.on("collect", async i => {
            if (i.user.id !== interaction.user.id)
                return i.reply({ content: "You cannot control this pagination.", ephemeral: true });

            if (i.customId === "next_page") {
                current_page = (current_page + 1) % embeds.length;
            } else if (i.customId === "prev_page") {
                current_page = (current_page - 1 + embeds.length) % embeds.length;
            }

            await i.update({
                embeds: [embeds[current_page]],
                components: [this.create_buttons()]
            });
        });

        collector.on("end", async () => {
            const disabled_row = this.create_buttons(true);
            await message.edit({ components: [disabled_row] });
        });
    }

    /**
     * Flushes current content into a page.
     */
    private flush() {
        if (this.current_page_content.length === 0) return;
        this.pages.push(this.current_page_content.join("\n"));
        this.current_page_content = [];
    }

    /**
     * Creates the buttons for the paginated embed builder.
     * 
     * @param disabled Whether or not the buttons are disabled
     * @returns An action row builder with the buttons
     */
    private create_buttons(disabled = false): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId("prev_page")
                .setLabel("⬅️ Previous")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId("next_page")
                .setLabel("Next ➡️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled)
        );
    }
}
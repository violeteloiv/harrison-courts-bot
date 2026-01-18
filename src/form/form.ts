import { DMChannel, Embed, EmbedBuilder, GuildMember, Message } from "discord.js";
import { BOT_SUCCESS_COLOR } from "../config";

export type QuestionResult = { type: "answer"; answer: Answer } |
                            { type: "skip", skipBy?: number } |
                            { type: "retry", error_embed: EmbedBuilder } |
                            { type: "none" };

export interface Question {
    prompt: string;
    handle(message: Message, previous_answers: Answer[]): Promise<QuestionResult> | QuestionResult;
}

export interface Answer {
    name: string,
    value: any
}

export interface Form {
    questions: Question[]
}

export interface FormResult {
    answers: Answer[];
    message: Message;
}

/**
 * Creates a question embed.
 * 
 * @param text The text of the question
 * @returns An embed
 */
function question_embed(text: string): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle("Form Question")
        .setDescription(text)
        .setColor(BOT_SUCCESS_COLOR)
        .setTimestamp();
}

/**
 * Creates a conclusion embed.
 * 
 * @returns An embed
 */
function conclusion_embed(): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle("Form Complete")
        .setDescription("Thank you for answering these questions. We are now processing your request.")
        .setColor(BOT_SUCCESS_COLOR)
        .setTimestamp();
}

/**
 * A function which awaits for a user to send a message, then returns it once sent.
 * 
 * @param channel The channel in which the message is being sent
 * @param user_id The user id of the individual sending messages
 * @param timeout The timeout period (default is 600,000 seconds)
 * @returns The message sent by the user
 */
async function await_user_messge(channel: DMChannel, user_id: string, timeout = 600_000): Promise<Message> {
    const collected = await channel.awaitMessages({
        filter: m => m.author.id === user_id,
        max: 1,
        time: timeout
    });

    if (!collected.size) {
        throw new Error("Form Timed Out");
    }

    return collected.first()!;
}

/**
 * Executes a created form
 * 
 * @param form The form to execute
 * @param member The member who is executing the form
 * @returns A result of the form
 */
export async function execute_form(form: Form, member: GuildMember): Promise<FormResult> {
    const dm = await member.createDM();
    const answers: Answer[] = [];

    for (let index = 0; index < form.questions.length; ) {
        const question = form.questions[index];

        await dm.send({
            embeds: [question_embed(question.prompt)]
        });
        let message: Message;

        try {
            message = await await_user_messge(dm, member.id);
        } catch {
            throw new Error("User Did Not Respond In Time.");
        }

        const result = await question.handle(message, answers);

        switch (result.type) {
            case "answer":
                answers.push(result.answer);
                index++;
                break;
            case "skip":
                index += result.skipBy ?? 2;
                break;
            case "none":
                index++;
                break;
            case "retry":
                await dm.send({ embeds: [result.error_embed] });
                break;
        }
    }

    const final_message = await dm.send({
        embeds: [conclusion_embed()]
    });

    return {
        answers,
        message: final_message
    };
}
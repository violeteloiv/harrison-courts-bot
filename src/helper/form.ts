import { EmbedBuilder, GuildMember, Message } from "discord.js";
import { createErrorEmbed } from "./format";

interface Question {
    question: string,
    callback: (message: Message, responses: any[]) => Answer,
}

export interface Answer {
    name: string,
    value: any
}

interface Answers {
    answers: Answer[],
    message: Message,
}

export interface Form {
    questions: Question[]
}

export async function executeForm(form: Form, member: GuildMember): Promise<Answers> {
    let answers: Answer[] = [];
    const dmChannel = await member.createDM();
    let index = 0;

    const askQuestion = async () => {
        if (index >= form.questions.length) return;
        const embed = new EmbedBuilder()
            .setTitle("Form Question")
            .setDescription(form.questions[index].question)
            .setColor("#9853b5")
            .setTimestamp();
        await dmChannel.send({ embeds: [embed] });
    };

    await askQuestion();

    return new Promise((resolve, reject) => {
        const collector = dmChannel.createMessageCollector({
            filter: m => m.author.id === member.id,
            time: 240_000 * form.questions.length
        });

        collector.on("collect", async message => {
            const question = form.questions[index];
            let result = question.callback(message, answers);

            if (result.name === "error") {
                await dmChannel.send({ embeds: [result.value] });
                await askQuestion();
            } else if (result.name == "skip") {
                index += 2;
            }else {
                answers.push(result);
                index++;
                await askQuestion();
            }

            if (index >= form.questions.length) {
                collector.stop("completed");
            }
        });

        collector.on("end", async () => {
            const embed = new EmbedBuilder()
                .setTitle("Form Conclusion")
                .setDescription("Thank you for answering these questions, we are now processing this information!")
                .setColor("#9853b5")
                .setTimestamp();
            let message = await dmChannel.send({ embeds: [embed] });

            resolve({ answers: answers, message: message });
        });
    });
}
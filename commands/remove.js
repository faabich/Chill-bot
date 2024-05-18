const { SlashCommandBuilder } = require("@discordjs/builders")
const { useQueue } = require("discord-player");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("Supprime un son de la playlist")
        .addStringOption(option =>
            option.setName("number").setDescription("N°(queue)").setRequired(true)
        ),
    execute: async ({ interaction }) => {
        let number = interaction.options.getString("number")
        // Get the current queue
        const queue = useQueue(interaction.guild.id);

        if (!queue) {
            await interaction.reply("Pas de son dans la playlist")
            return;
        }

        // Deletes all the songs from the queue and exits the channel
        queue.removeTrack(number - 1);

        await interaction.reply("Son retiré !")
    },
}
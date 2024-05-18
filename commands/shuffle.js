const { SlashCommandBuilder } = require("@discordjs/builders")
const { useQueue } = require("discord-player");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shuffle")
        .setDescription("Mélange la playlist"),
    execute: async ({ interaction }) => {

        // Get the current queue
        const queue = useQueue(interaction.guild.id);

        if (!queue) {
            await interaction.reply("Pas de son dans la playlist")
            return;
        }

        // Deletes all the songs from the queue and exits the channel
        queue.tracks.shuffle();

        await interaction.reply("Playlist mélangée")
    },
}
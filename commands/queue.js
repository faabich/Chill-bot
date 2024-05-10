const { SlashCommandBuilder } = require("@discordjs/builders")
const { EmbedBuilder } = require("discord.js")
const { useQueue } = require("discord-player");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue")
        .setDescription("affiche les sons de la playlist"),

    execute: async ({ interaction }) => {
      const queue = useQueue(interaction.guild.id);

        // check if there are songs in the queue
        if (!queue)
        {
            await interaction.reply("Pas de son dans la playlist");
            return;
        }

        const tracks = queue.tracks.data;
       
        // Get the first 10 songs in the queue
        const queueArray = tracks.slice(0, 10).map((song, i) => {
            return `${i + 1}) [${song.duration}] ${song.title} - ${song.author} @${song.requestedBy.username}`
        }).join("\n")

        // Get the current song
        const currentSong = queue.currentTrack

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`**Currently Playing**\n` + 
                        (currentSong ? `[${currentSong.duration}] ${currentSong.title} - @${currentSong.requestedBy.username}` : "None") + `\n\n**Queue**\n${queueArray}`
                    )
                    .setThumbnail(currentSong.setThumbnail)
            ]
        })
    }
}
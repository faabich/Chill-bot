const { SlashCommandBuilder } = require("@discordjs/builders")
const { EmbedBuilder, Colors } = require("discord.js")
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
        .setName("pause-play")
        .setDescription("Pause/play le bon son"),
  execute: async ({ interaction }) => {
        // Get the queue for the server
    const queue = useQueue(interaction.guild.id);
    if (!queue){
      await interaction.reply("Pas de son dans la liste")
      return;
    }

    queue.node.setPaused(!queue.node.isPaused());//isPaused() returns true if that player is already paused

    // Return an embed to the user saying the song has been skipped
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(Colors.Orange)
                .setDescription(`**${queue.currentTrack.title} - ${queue.currentTrack.author}** ${queue.node.isPaused() ? "[Pause]" : "[Play]"}`)
                .setThumbnail(queue.currentTrack.thumbnail)
        ]
    })

    //await interaction.reply(queue.node.isPaused() ? "Pause" : "Play")
  },
}
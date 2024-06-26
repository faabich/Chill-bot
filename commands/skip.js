const { SlashCommandBuilder } = require("@discordjs/builders")
const { EmbedBuilder } = require("discord.js")
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip a song"),

  execute: async ({ interaction }) => {

        // Get the queue for the server
    const queue = useQueue(interaction.guild.id);

        // If there is no queue, return
    if (!queue) return await interaction.reply("Empty playlist");
        
    queue.node.skip()
        
    if (!queue) return await interaction.reply("Empty playlist");

        // Return an embed to the user saying the song has been skipped
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`${queue.currentTrack.title} skipped!`)
                    .setThumbnail(queue.currentTrack.thumbnail)
            ]
        })
  },
}
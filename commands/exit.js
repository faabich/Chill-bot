const { SlashCommandBuilder } = require("@discordjs/builders")
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Dégage le bot musique"),
  execute: async ({ interaction }) => {

        // Get the current queue
    const queue = useQueue(interaction.guild.id);
    
    if (!queue)
    {
      await interaction.reply("There are no songs in the queue")
      return;
    }

        // Deletes all the songs from the queue and exits the channel
    queue.delete();

        await interaction.reply("C'était du bon son sérieux...")
  },
}
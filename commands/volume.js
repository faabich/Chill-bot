const { SlashCommandBuilder } = require("@discordjs/builders")
const { useQueue } = require("discord-player");

const SHORT_TIMER = 15_000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("volume")
        .setDescription("Change music player volume")
        .addStringOption(option =>
            option.setName("volume").setDescription("volume").setRequired(true)
        ),
    execute: async ({ interaction }) => {
        var volume = interaction.options.getString("volume")
        // Get the current queue
        const queue = useQueue(interaction.guild.id);

        if (!queue) {
            await interaction.reply("No songs in playlist...")
            return;
        }

        queue.node.setVolume(parseInt(volume)); //Pass the value for the volume here

        await interaction.reply(`Volume changed to ${volume}`)
            .then(msg => {
                setTimeout(() => msg.delete(), SHORT_TIMER);

            }).catch(error => {
                console.log(error);
            });
    },
}
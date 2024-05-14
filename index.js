require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Colors, Client, GatewayIntentBits, Collection, ActionRowBuilder,
   ComponentType, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { Player, useHistory } = require("discord-player");

const fs = require('fs');
const path = require('path');

const client = new Client({
   intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates, 'GuildVoiceStates']
});

// List of all commands
const commands = [];
client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands"); // E:\yt\discord bot\js\intro\commands
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
   const filePath = path.join(commandsPath, file);
   const command = require(filePath);

   client.commands.set(command.data.name, command);
   commands.push(command.data.toJSON());
}

// Add the player on the client
client.player = new Player(client, {
   ytdlOptions: {
      filter: "audioonly",
      fmt: "mp3",
      highWaterMark: 1 << 62,
      liveBuffer: 1 << 62,
      dlChunkSize: 0, //disabling chunking is recommended in discord bot
      bitrate: 128,
      quality: "highestaudio"
   }
})

client.on("ready", function (readyClient) {
   // Get all ids of the servers
   const guild_ids = client.guilds.cache.map(guild => guild.id);

   const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);
   for (const guildId of guild_ids) {
      rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
         { body: commands })
         .then(() => console.log('Successfully updated commands for guild ' + guildId))
         .catch(console.error);
   }
});

client.on("interactionCreate", async (interaction) => {
   if (!interaction.isCommand()) return;

   const command = client.commands.get(interaction.commandName);
   if (!command) return;

   try {
      await command.execute({ client, interaction });
   }
   catch (error) {
      console.error(error);
      await interaction.reply({ content: "There was an error executing this command" });
   }
});

var channelID;
client.on('messageCreate', (message) => {
   if (message.author.bot){
      channelID = message.channelId;
   }
})

const player = new Player(client);

player.extractors.loadDefault();


// this event is emitted whenever discord-player starts to play a track
player.events.on('playerStart', async (queue, track) => {
   const history = useHistory(queue.guild.id);
   // we will later define queue.metadata object while creating the queue
   const channel = client.channels.cache.get(channelID);

   const prev = new ButtonBuilder()
      .setCustomId('prev')
      .setEmoji('⏮')
      .setStyle(ButtonStyle.Secondary);

   const playPause = new ButtonBuilder()
      .setCustomId('play-pause')
      .setEmoji('⏯️')
      .setStyle(ButtonStyle.Secondary);

   const next = new ButtonBuilder()
      .setCustomId('next')
      .setEmoji('⏭')
      .setStyle(ButtonStyle.Secondary);

   const stop = new ButtonBuilder()
      .setCustomId('stop')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Secondary);

   const shuffle = new ButtonBuilder()
      .setCustomId('shuffle')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary);

   const link = new ButtonBuilder()
      .setEmoji('🌐')
      .setURL(track.url)
      .setStyle(ButtonStyle.Link);

   const row = new ActionRowBuilder()
      .addComponents(prev, playPause, next, stop, shuffle);

   //const lastMessageId = channel.lastMessageId;
   /* var lastMessageId;
   if (lastMessageId) {
      channel.messages.fetch(lastMessageId).then(message => message.delete())
   } */

   const reply = await channel.send({
      embeds: [
         new EmbedBuilder()
            .setColor(Colors.Orange)
            .setTitle(`**En train de jouer**`)
            .setThumbnail(track.thumbnail)
            .setDescription(`${track.title} - ${track.author} [${track.duration}]\n Demandé par @${track.requestedBy.username}`)
      ],
      components: [row]
   });
   var lastMessageId = reply.id;

   //const filter = i => i.user.id === interaction.user.id;

   const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button
      //filter,
   })

   collector.on('collect', async (interaction) => {
      if (interaction.customId === 'prev') {
         await history.previous();
         await interaction.update("Son précédent")
         .then(await channel.messages.fetch(lastMessageId).then(message => message.delete()));
      }
      if (interaction.customId === 'play-pause') {
         queue.node.setPaused(!queue.node.isPaused());
         await interaction.update(queue.node.isPaused() ? "Pause" : "Play");
      }
      if (interaction.customId === 'next') {
         queue.node.skip();
         await interaction.update("Son suivant")
         .then(await channel.messages.fetch(lastMessageId).then(message => message.delete()));
      }
      if (interaction.customId === 'stop') {
         queue.delete();
         await interaction.update("Playlist arrêtée")
         .then(await channel.messages.fetch(lastMessageId).then(message => message.delete()));
      }
      if (interaction.customId === 'shuffle') {
         queue.tracks.shuffle();
         await interaction.update("Playlist mélangée");
      }

      return;
   })
});


client.login(process.env.TOKEN);
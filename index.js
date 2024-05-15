require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Colors, Client, GatewayIntentBits, Collection, ActionRowBuilder,
    ComponentType, ButtonBuilder, ButtonStyle, EmbedBuilder, ActivityType } = require('discord.js');
const { Player } = require("discord-player");
const { refreshSpotifyToken } = require('./Spotify/API/spotify-auth')

const fs = require('fs');
const path = require('path');
const { setInterval, setTimeout } = require('timers');

const SHORT_TIMER = 15_000;

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
        quality: "lowestaudio"
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

    client.user.setActivity({
        name: 'les étoiles...',
        type: ActivityType.Watching
    })

    // Refresh token
    setInterval(refreshSpotifyToken, 1000 * 59 * 59);
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
    if (message.author.bot) {
        channelID = message.channelId;
    }
})

const player = new Player(client);

player.extractors.loadDefault();

var playerMessageId;
// this event is emitted whenever discord-player starts to play a track
player.events.on('playerStart', async (queue, track) => {
    // we will later define queue.metadata object while creating the queue
    const channel = client.channels.cache.get(channelID);

    const playPause = new ButtonBuilder()
        .setCustomId('play-pause')
        .setEmoji('⏯')
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

    const queueSearch = new ButtonBuilder()
        .setCustomId('queue')
        .setEmoji('🔍')
        .setStyle(ButtonStyle.Secondary);

    const link = new ButtonBuilder()
        .setEmoji('🌐')
        .setURL(track.url)
        .setStyle(ButtonStyle.Link);

    const row = new ActionRowBuilder()
        .addComponents(playPause, next, stop, shuffle, queueSearch);


    const embed = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle(`**📀 En train de jouer**`)
        .setURL(track.url)
        .setImage(track.thumbnail)
        .addFields({
            name: "Titre",
            value: track.title,
            inline: true,
        }, {
            name: "Auteur",
            value: track.author,
            inline: true,
        }, {
            name: "Durée",
            value: track.duration,
            inline: true,
        })
        .setFooter({ text: `Demandé par @${track.requestedBy.username}` })
        .setTimestamp();

    if (playerMessageId) {
        try {
            await channel.messages.fetch(playerMessageId).then(message => message.delete())
        } catch (error) {

        }
    }

    const reply = await channel.send({
        embeds: [embed],
        components: [row],
        fetchReply: true
    });

    playerMessageId = reply.id;

    //const filter = i => i.user.id === interaction.user.id;

    const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button
        //filter,
    })

    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'play-pause') {
            queue.node.setPaused(!queue.node.isPaused());
            await interaction.update(queue.node.isPaused() ? "Pause" : "Play");
        }
        if (interaction.customId === 'next') {
            queue.node.skip();
            if (!queue.isEmpty()) {
                await interaction.update("Son suivant")
            } else {
                await interaction.update("Playlist vide")
                    .then(await channel.messages
                        .fetch(playerMessageId)
                        .then(message => message.delete()));
            }
        }
        if (interaction.customId === 'stop') {
            queue.delete();
            await interaction.update("Playlist arrêtée")
                .then(await channel.messages
                    .fetch(playerMessageId)
                    .then(message => message
                        .delete()
                        .catch((err) => console.log('Could not delete the message', err))
                    ))
                .catch((err) => {
                    if (err.code === 10008) {
                        console.log('Message already deleted');
                    } else {
                        console.log(err);
                    }
                });
        }
        if (interaction.customId === 'shuffle') {
            queue.tracks.shuffle();
            await interaction.update("Playlist mélangée");
        }
        if (interaction.customId === 'queue') {
            const tracks = queue.tracks.data;

            // Get the first 10 songs in the queue
            const queueArray = tracks.slice(0, 10).map((song, i) => {
                return `${i + 1}) [${song.duration}] ${song.title} - ${song.author} @${song.requestedBy.username}`
            }).join("\n")
            await interaction.update("Affiche la playlist")
            await interaction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`**En ce moment**\n` +
                            (track ? `[${track.duration}] ${track.title} - @${track.requestedBy.username}` : "Aucun") + `\n\n**Playlist**\n${queueArray || "Pas d'autres sons..."}`
                        )
                        .setThumbnail(track.thumbnail)
                ]
            }).then(msg => {
                setTimeout(() => msg.delete(), SHORT_TIMER);

            }).catch(error => {
                console.log(error);
            });
        }

        return;
    })
});

/* player.events.on('emptyQueue', async (queue) => {
    // Emitted when the player queue has finished
    const channel = client.channels.cache.get(channelID);
    try {
        console.log(`From emptyQueue: playerMessageId: ${playerMessageId} | channelID: ${channelID}`);
        //await channel.messages.fetch(playerMessageId).then(message => console.log(message));

        return await channel.messages.fetch(playerMessageId).then(message => message.delete()).then(error => console.log(error))
    } catch (error) {
        console.error(error);
    }
}); */

player.events.on('disconnect', async (queue) => {
    // Emitted when the bot leaves the voice channel
    const channel = client.channels.cache.get(channelID);
    setTimeout(async () => {
        await channel.messages.fetch(playerMessageId).then((fetchedMessage) => {
            fetchedMessage
                .delete()
                .catch((err) => console.log('Could not delete the message', err));
        })
            .catch((err) => {
                if (err.code === 10008) {
                    //console.log('Message already deleted');
                } else {
                    console.log(err);
                }
            });
    }, 1000)
});


client.login(process.env.TOKEN);
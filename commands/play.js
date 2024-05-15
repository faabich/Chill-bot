const { SlashCommandBuilder } = require("@discordjs/builders")
const { EmbedBuilder, Colors, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    ActionRowBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require("discord.js")
const { QueryType, useMainPlayer } = require("discord-player");
const { getPlaylist } = require("../Spotify/API/spotify-auth");
const { response } = require("express");

const SHORT_TIMER = 15_000;
const LONG_TIMER = 30_000;

async function playUrl(interaction, url) {
    const player = useMainPlayer();
    await interaction.deferReply();
    //const result = new SearchResult(player, _data)
    const result = await player.search(url, {
        requestedBy: interaction.user
    })
    //console.log(result);
    addQueue(interaction, result.tracks);

    await interaction.editReply({
        embeds: [
            new EmbedBuilder()
                .setColor(Colors.Orange)
                .setTitle(`**Sélection Playlist**`)
                .setThumbnail(result.playlist.thumbnail)
                .setDescription(`${result.playlist.title} [${Object.keys(result.tracks).length} musiques ajoutées]\n Demandé par @${result.requestedBy.username}`)
        ],
        fetchReply: true
    }).then(msg => {
        setTimeout(() => msg.delete(), SHORT_TIMER);

    }).catch(error => {
        console.log(error);
    });
}

async function addQueue(interaction, track) {
    const player = useMainPlayer();
    const queue = player.nodes.create(interaction.guild.id, {
        nodeOptions: {
            metadata: interaction.channel,
            bufferingTimeout: 15000, //How long the player should attempt buffering before giving up
            //leaveOnStop: true, //If player should leave the voice channel after user stops the player
            //leaveOnStopCooldown: 5000, //Cooldown in ms
            leaveOnEnd: true, //If player should leave after the whole queue is over
            leaveOnEndCooldown: 15000, //Cooldown in ms
            leaveOnEmpty: true, //If the player should leave when the voice channel is empty
            leaveOnEmptyCooldown: 300000, //Cooldown in ms
            volume: 25,
            skipOnNoStream: true,
        },
    });

    // acquire task entry
    const entry = queue.tasksQueue.acquire();

    // wait for previous task to be released and our task to be resolved
    await entry.getTask();

    // add track(s) (this will add playlist or single track from the result)
    //console.log(track)
    queue.addTrack(track);

    try {
        // if player node was not previously playing, play a song
        if (!queue.isPlaying()) await queue.node.play();
    } finally {
        // release the task we acquired to let other tasks to be executed
        // make sure you are releasing your entry, otherwise your bot won't
        // accept new play requests
        queue.tasksQueue.release();
    }
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("play a song from YouTube.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("search-song")
                .setDescription("Recherche un son et le joue [+ajoute à la liste]")
                .addStringOption(option =>
                    option.setName("search").setDescription("mots-clés").setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("search-playlist")
                .setDescription("Recherche une playlist et le joue [+ajoute à la liste]")
                .addStringOption(option =>
                    option.setName("search").setDescription("mots-clés").setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("playlist")
                .setDescription("Joues une playlist de Youtube")
                .addStringOption(option => option.setName("url").setDescription("Lien de la playlist").setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("song")
                .setDescription("Joue une musique de Youtube")
                .addStringOption(option => option.setName("url").setDescription("Lien du son").setRequired(true))
        ),
    execute: async ({ client, interaction }) => {
        // Make sure the user is inside a voice channel
        if (!interaction.member.voice.channel) return interaction.reply("Tu dois être dans un chat vocal pour mettre du bon son");

        // Create a play queue for the server
        const queue = await client.player.nodes.create(interaction.guild);

        // Wait until you are connected to the channel
        if (!queue.connection) await queue.connect(interaction.member.voice.channel)

        let embed = new EmbedBuilder()

        if (interaction.options.getSubcommand() === "song") {
            let url = interaction.options.getString("url")

            // Search for the song using the discord-player
            const result = await client.player.search(url, {
                requestedBy: interaction.user,
                searchEngine: QueryType.YOUTUBE_SEARCH
            })

            // finish if no tracks were found
            if (!result)
                return interaction.reply("No results")

            // Add the track to the queue
            const song = result.tracks[0]
            await addQueue(interaction, song);
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(Colors.Orange)
                        .setTitle(`**Sélection**`)
                        .setThumbnail(result.thumbnail)
                        .setDescription(`**[${song.title}](${song.url})** ajouté à la playlist\n Demandé par @${result.requestedBy.username}`)
                ]
            });
        }
        else if (interaction.options.getSubcommand() === "playlist") {

            // Search for the playlist using the discord-player
            let url = interaction.options.getString("url")
            const result = await client.player.search(url, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO
            })

            if (!result)
                return interaction.reply(`No playlists found with ${url}`)

            // Add the tracks to the queue
            const playlist = result.playlist
            await addQueue(interaction, result.tracks)
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(Colors.Orange)
                        .setTitle(`**Sélection**`)
                        .setThumbnail(result.thumbnail)
                        .setDescription(`**${result.tracks.length} sons de [${playlist.title}](${playlist.url})** ajoutés\n Demandé par @${result.requestedBy.username}`)
                ]
            });
        }
        else if (interaction.options.getSubcommand() === "search-song") {
            const player = useMainPlayer();
            let query = interaction.options.getString("search")
            const results = await player.search(query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.SPOTIFY_SEARCH
            })
            if (!results) return await interaction.reply("Pas trouvé de son");

            const select = new StringSelectMenuBuilder()
                .setCustomId('select')
                .setPlaceholder('Choisis ton son')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(
                    results.tracks.slice(0, 10).flatMap((track, i) =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`${track.title.slice(0, 70)} - ${track.author.slice(0, 20)}`)
                            .setDescription(track.duration)
                            .setValue(track.url)
                    )
                )

            const actionRow = new ActionRowBuilder().addComponents(select);

            const reply = await interaction.reply({
                content: 'Fais une selection',
                components: [actionRow],
                fetchReply: true
            });

            setTimeout(async function () {
                await interaction.channel.messages.fetch(reply.id).then(message => message.delete())
            }, LONG_TIMER);

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: (i) => i.user.id === interaction.user.id,
                time: 60_000,
            });

            collector.on('collect', async (interaction) => {
                if (!interaction.values.length) {
                    interaction.reply("Aucune selection");
                    return;
                }

                const result = results.tracks.slice(0, 10).find(track => track.url == interaction.values);

                addQueue(interaction, result);

                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(Colors.Orange)
                            .setTitle(`**Sélection**`)
                            .setThumbnail(result.thumbnail)
                            .setDescription(`${result.title} - ${result.author} [${result.duration}]\n Demandé par @${result.requestedBy.username}`)
                    ],
                    fetchReply: true
                }).then(msg => {
                    setTimeout(() => msg.delete(), SHORT_TIMER);

                }).catch(error => {
                    console.log(error);
                });

                return;
            })

        } else if (interaction.options.getSubcommand() === "search-playlist") {
            let query = interaction.options.getString("search")
            const playlistData = await getPlaylist(query);
            if (!playlistData) return await interaction.reply("Pas trouvé de playlist");

            const select = new StringSelectMenuBuilder()
                .setCustomId('select')
                .setPlaceholder('Choisis ta playlist')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(
                    playlistData.slice(0, 20).flatMap((playlist, i) =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`[${playlist.tracks.total}] ${playlist.name.slice(0, 70)}`)
                            .setDescription(playlist.description.slice(0, 100) || 'Pas de description')
                            .setValue(playlist.external_urls.spotify)
                    )
                )

            const actionRow = new ActionRowBuilder().addComponents(select);

            const reply = await interaction.reply({
                content: 'Fais une sélection',
                components: [actionRow],
                fetchReply: true
            });

            setTimeout(async function () {
                await interaction.channel.messages.fetch(reply.id).then(message => message.delete())
            }, LONG_TIMER)

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: (i) => i.user.id === interaction.user.id,
                time: 60_000,
            });

            collector.on('collect', (interaction) => {
                if (!interaction.values.length) {
                    interaction.reply("Aucune selection");
                    return;
                }

                const playlistFound = playlistData.slice(0, 20).find(playlist => playlist.external_urls.spotify == interaction.values);
                playlistUrl = playlistFound.external_urls.spotify;
                playUrl(interaction, playlistUrl)
            })
        }
    },
}
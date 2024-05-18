const SpotifyWebApi = require('spotify-web-api-node');
const querystring = require('querystring')
const express = require('express');
const axios = require('axios');
var app = express();

var PORT = 8113;

const logger = (req, res, next) => {
    console.log(`
   ${req.method} 
   ${req.url} 
   ${req.ip}`);
    next();
};
//app.use(logger)

const generateRandomString = length => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;
const stateKey = 'spotify_auth_state';

const spotifyApi = new SpotifyWebApi({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uri
});

async function getPlaylist(query) {
    return new Promise((resolve, reject) => {
        spotifyApi.searchPlaylists(query)
            .then(function (data) {
                const playlistsData = data.body.playlists.items;
                resolve(playlistsData);
            })
            .catch(function (err) {
                console.log('Something went wrong!', err);
            });
    });
}

app.get('/auth/spotify', (req, res) => {
    // TUTORIAL VIDEO
    const state = generateRandomString(64);
    res.cookie(stateKey, state);

    const scope = 'user-read-private user-read-email';

    const queryParams = querystring.stringify({
        client_id: client_id,
        response_type: 'code',
        redirect_uri: redirect_uri,
        state: state,
        scope: scope,
    });

    res.redirect(`https://accounts.spotify.com/authorize?${queryParams}`);
});

// When our access token will expire
let tokenExpirationEpoch;
app.get('/callback', (req, res) => {
    // TUTORIAL VID
    const code = req.query.code || null;

    // First retrieve an access token
    spotifyApi.authorizationCodeGrant(code).then(
        function (data) {
            // Set the access token and refresh token
            spotifyApi.setAccessToken(data.body['access_token']);
            spotifyApi.setRefreshToken(data.body['refresh_token']);

            // Save the amount of seconds until the access token expired
            tokenExpirationEpoch = new Date().getTime() / 1000 + data.body['expires_in'];
            console.log(
                'Retrieved token. It expires in ' +
                Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) +
                ' seconds!'
            );
        },
        function (err) {
            console.log(
                'Something went wrong when retrieving the access token!_!',
                err.message
            );
        }
    );
});

app.get('/refresh_token', (req, res) => {
    // TUTORIAL VIDEO
    const { refresh_token } = req.query;

    axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        data: querystring.stringify({
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        }),
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${new Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`,
        },
    })
        .then(response => {
            res.send(response.data);
        })
        .catch(error => {
            res.send(error);
        });
});

app.listen(PORT, () =>
    console.log(
        `HTTP Server up. Now go to http://localhost:${PORT}/auth/spotify in your browser.`
    )
);

// Refresh token
function refreshSpotifyToken() {
    spotifyApi.refreshAccessToken().then(
        function (data) {
            spotifyApi.setAccessToken(data.body.access_token);
            tokenExpirationEpoch =
                new Date().getTime() / 1000 + data.body['expires_in'];
            /* console.log(
               'Refreshed token. It now expires in ' +
               Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) +
               ' seconds!'
            ); */
        },
        function (err) {
            console.log('Could not refresh the token!', err.message);
        }
    );
}

module.exports = { refreshSpotifyToken, getPlaylist }
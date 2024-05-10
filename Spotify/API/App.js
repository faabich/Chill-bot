const SpotifyWebApi = require('spotify-web-api-node');
const querystring = require('querystring')
const request = require('request');
const express = require('express');
var app = express();

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;
const stateKey = 'spotify_auth_state';

const spotifyApi = new SpotifyWebApi({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uri
});

const generateRandomString = length => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

app.get('/auth/spotify', function (req, res) {

    var state = generateRandomString(16);
    var scope = 'user-read-private user-read-email';

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});

// When our access token will expire
var tokenExpirationEpoch;
app.get('/callback/', function (req, res) {

    var code = req.query.code || null;
    var state = req.query.state || null;

    if (state === null) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
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
                // Redirecting back to the main page
                res.redirect('/');
            },
            function (err) {
                console.log(
                    'Something went wrong when retrieving the access token!_!',
                    err.message
                );
            }
        );

        //console.log(authOptions);
    }
});

app.get('/refresh_token', function (req, res) {

    var refresh_token = req.query.refresh_token;
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
        },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token,
                refresh_token = body.refresh_token;
            res.send({
                'access_token': access_token,
                'refresh_token': refresh_token
            });
        }
    });
});

/*app.listen(8113, () =>
    console.log(
        'HTTP Server up. Now go to http://us-nyc.pylex.me:8113/auth/spotify in your browser.'
    )
);*/

// Auto refresh token
/*setInterval(function () {
    if (tokenExpirationEpoch < 10) {
        // Refresh token and print the new time to expiration.
        spotifyApi.refreshAccessToken().then(
            function (data) {
                tokenExpirationEpoch =
                    new Date().getTime() / 1000 + data.body['expires_in'];
                console.log(
                    'Refreshed token. It now expires in ' +
                    Math.floor(tokenExpirationEpoch - new Date().getTime() / 1000) +
                    ' seconds!'
                );
            },
            function (err) {
                console.log('Could not refresh the token!', err.message);
            }
        );
    }
}, 10000);*/

module.exports = { spotifyApi }
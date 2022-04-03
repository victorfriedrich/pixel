const express = require('express');
const fs = require('fs');
const ws = require('ws');
const request = require('request');
const signale = require('signale');

const app = express();

RAW_GITHUB_BASE_URL = "https://raw.githubusercontent.com/etonaly/pixel/"
PIXEL_URL = RAW_GITHUB_BASE_URL + "main/pixel.json"
IMAGE_URL = "https://github.com/etonaly/pixel/raw/main/output.png"
COMMIT_URL = "https://api.github.com/repos/etonaly/pixel/commits?path=output.png"
var appData = {
    currentJson: {},
    currentMap: "blank.png",
    mapHistory: [],
}

getJson().then(json => {
    appData.currentJson = json;
}).catch(err => { signale.error(err) })

getImage().then(image => {
    appData.currentMap = image;
}).catch(err => { signale.error(err) });

getHistory();




var brandUsage = {};
var socketId = 0;

if (fs.existsSync(`${__dirname}/data.json`)) {
    appData = require(`${__dirname}/data.json`);
}

const server = app.listen(3987);
const wsServer = new ws.Server({ server: server, path: '/api/ws' });

app.use('/maps', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});
app.use('/maps', express.static(`${__dirname}/maps`));
app.use(express.static(`${__dirname}/static`));

app.get('/api/stats', (req, res) => {
    res.json({
        connectionCount: wsServer.clients.size,
        ...appData,
        brands: brandUsage,
        date: Date.now()
    });
});

wsServer.on('connection', (socket) => {
    socket.id = socketId++;
    socket.brand = 'unknown';
    console.log(`[${new Date().toLocaleString()}] [+] Client connected: ${socket.id}`);

    socket.on('close', () => {
        console.log(`[${new Date().toLocaleString()}] [-] Client disconnected: ${socket.id}`);
    });

    socket.on('message', (message) => {
        var data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            socket.send(JSON.stringify({ type: 'error', data: 'Failed to parse message!' }));
            return;
        }

        if (!data.type) {
            socket.send(JSON.stringify({ type: 'error', data: 'Data missing type!' }));
        }

        switch (data.type.toLowerCase()) {
            case 'brand':
                const { brand } = data;
                if (brand === undefined || brand.length < 1 || brand.length > 32 || !isAlphaNumeric(brand)) return;
                socket.brand = data.brand;
                break;
            case 'getmap':
                socket.send(JSON.stringify({ type: 'map', data: appData.currentJson }));
                break;
            case 'getmapimage':
                socket.send(JSON.stringify({ type: 'mapimage', data: appData.currentMap, reason: null }))
                break;
            case 'ping':
                socket.send(JSON.stringify({ type: 'pong' }));
                break;
            case 'placepixel':
                const { x, y, color } = data;
                if (x === undefined || y === undefined || color === undefined && x < 0 || x > 1999 || y < 0 || y > 1999 || color < 0 || color > 32) return;
                // console.log(`[${new Date().toLocaleString()}] Pixel placed by ${socket.id}: ${x}, ${y}: ${color}`);
                break;
            default:
                socket.send(JSON.stringify({ type: 'error', data: 'Unknown command!' }));
                break;
        }
    });
});

setInterval(() => {
    brandUsage = Array.from(wsServer.clients).map(c => c.brand).reduce(function (acc, curr) {
        return acc[curr] ? ++acc[curr] : acc[curr] = 1, acc
    }, {});
}, 1000);

function getJson() {
    return new Promise(function (resolve, reject) {
        request(
            { uri: PIXEL_URL },
            function (error, _response, body) {
                if (error) {
                    console.log(error);
                    reject(error);
                }
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    console.log(e);
                    reject(error);
                }
            }
        )
    })
}

function getImage() {
    return new Promise(function (resolve, reject) {
        const file = `${Date.now()}.png`;
        const path = `${__dirname}/maps/${file}`
        request
            .get(IMAGE_URL)
            .on('error', function (err) {
                console.error(err)
                reject(err);
            })
            .pipe(fs.createWriteStream(path));
        resolve(file);
    });
}

function getLatestCommitMessage() {
    return new Promise(function (resolve, reject) {
        request(
            { uri: COMMIT_URL, headers: { 'User-Agent': "Mozilla/5.0 (Linux; Android 8.0.0; SM-G960F Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36" } },
            function (error, _response, body) {
                if (error) {
                    console.log(error);
                    resolve("Github Update");
                }
                try {
                    const commits = JSON.parse(body);
                    resolve(commits[0]["commit"]["message"]);
                } catch (e) {
                    console.log(e);
                    resolve("Github Update");
                }
            }
        )
    });
}
function getHistory(limit = 10) {
    return new Promise(function (resolve, reject) {
        request(
            { uri: COMMIT_URL, headers: { 'User-Agent': "Mozilla/5.0 (Linux; Android 8.0.0; SM-G960F Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36" } },
            function (error, _response, body) {
                if (error) {
                    resolve(error);
                }
                try {
                    const commits = JSON.parse(body);
                    resolve(commits);
                } catch (e) {
                    resolve(error);
                }
            }
        )
    }).catch(err => { signale.error(err) }).then(commits => {
        commits.length = Math.min(commits.length, limit);
        commits.reverse();
        for (var commit of commits) {
            try {
                console.log(commit);
                new Promise(function (resolve, reject) {
                    var commit_image_url = RAW_GITHUB_BASE_URL + commit["sha"] + "/output.png";
                    var new_message = commit["commit"]["message"];
                    var new_date = Date.parse(commit["commit"]["author"]["date"]);
                    const file = `${new_date}.png`;
                    const path = `${__dirname}/maps/${file}`
                    request
                        .get(commit_image_url)
                        .on('error', function (err) {
                            console.error(err)
                            reject(err);
                        })
                        .pipe(fs.createWriteStream(path));
                    resolve([file, new_message, new_date]);
                }).then( arr => {
                    appData.mapHistory.push({
                        message: arr[1],
                        image: arr[0],
                        date: arr[2]
                    })
                }).catch(e => signale.error(e));
            } catch (e) {
                signale.error(e)
            }
        }

    });
}

setInterval(() => {
    getJson().then(newJson => {
        // got new map
        if (JSON.stringify(newJson) != JSON.stringify(appData.currentJson)) {

            appData.currentJson = newJson;
            wsServer.clients.forEach((client) => client.send(JSON.stringify({ type: 'map', data: newJson, reason: null })));
            console.log("[+] New map received!");

            //get new image
            getImage().then(file => {
                if (file) {
                    appData.currentMap = file;
                    getLatestCommitMessage().then(message => {
                        appData.mapHistory.push({
                            image: file,
                            message: message,
                            date: Date.now()
                        })
                    }).catch(err => { signale.error(err) })
                }
            }).catch(err => { signale.error(err) })
        }
    }).catch(err => { signale.error(err) })

}, 60000);

function isAlphaNumeric(str) {
    var code, i, len;

    for (i = 0, len = str.length; i < len; i++) {
        code = str.charCodeAt(i);
        if (!(code > 47 && code < 58) && // numeric (0-9)
            !(code > 64 && code < 91) && // upper alpha (A-Z)
            !(code > 96 && code < 123)) { // lower alpha (a-z)
            return false;
        }
    }
    return true;
}  

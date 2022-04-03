const express = require('express');
const fs = require('fs');
const ws = require('ws');
const request = require('request');

const app = express();

PIXEL_URL = "https://raw.githubusercontent.com/etonaly/pixel/main/pixel.json"
IMAGE_URL = "https://github.com/etonaly/pixel/raw/main/output.png"

const currentImage = getImage()
var appData = {
    currentJson: getJson(),
    currentMap: currentImage,
    mapHistory: [
        currentImage
    ]
};
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
                socket.send(JSON.stringify(appData.currentJson));
                break;
            case 'getmapimage':
                socket.send(JSON.stringify({ type: 'map', data: appData.cuurentMap, reason: null }))
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
    request(
        { uri: PIXEL_URL },
        function (error, _response, body) {
            if (error) {
                console.log(error);
                return undefined;
            }
            try {
                return newJson = JSON.parse(body);
            } catch (e) {
                console.log(e);
                return undefined;
            }
        }
    );
}

function getImage() {
    const file = `${Date.now()}.png`;
    const path = `${__dirname}/maps/${file}`
    request
        .get(IMAGE_URL)
        .on('error', function (err) {
            console.error(err)
            return undefined;
        })
        .pipe(fs.createWriteStream(path));
    return file
}

setInterval(() => {
    const newJson = getJson();
    if (newJson) {
        // got new map
        if (JSON.stringify(newJson) != JSON.stringify(appData.currentJson)) {

            appData.currentJson = newJson;
            wsServer.clients.forEach((client) => client.send(JSON.stringify({ type: 'map', data: newJson, reason: null })));
            console.log("[+] New map received!");

            //get new image
            const file = getImage();
            if (file) {
                appData.currentMap = file;
                appData.mapHistory.push({
                    file,
                    reason: "Github Update",
                    date: Date.now()
                })
            }

        }
    } 
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

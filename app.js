/*  Copyright 2016 Andy Yu
    Usage : node app.js
*/

var port            = process.env.PORT || 1337,

    io              = require('socket.io'),
    express         = require('express'),
    UUID            = require('node-uuid'),

    verbose         = false,
    http            = require('http'),
    app             = express(),
    server          = http.createServer(app);

/* Express */

server.listen(port)
console.log('\n Express running and listening on port ' + port );

app.get('/', function(req, res) {
    res.sendfile( '/public/index.html' , { root:__dirname });
});

app.get('/*', function(req, res, next) {    // DANGER! THIS WILL SERVE ANYTHING FROM ROOT
    var file = req.params[0];
    if (verbose) console.log('\t :: Express :: file requested : ' + file);
    res.sendfile(__dirname + '/' + file);
}); //app.get *


/* Socket.io */   

var socket = io.listen(server);

// game server - handles client/game connection
game_server = require('./server/game.server.js');

// client connection
socket.sockets.on('connection', function (client) {
    // user specific ID
    client.userid = UUID();

    // confirm connection to client
    client.emit('onconnected', { id: client.userid } );
    
    // find game, or host if none active
    game_server.findGame(client);

    console.log('\t socket.io:: player ' + client.userid + ' connected');   // DEBUG
    
    // receive messages from client, send them to game server to handle
    client.on('message', function(m) {
        game_server.onMessage(client, m);
    }); //client.on message

    // disconnected client, must send notification to game server
    client.on('disconnect', function () {

        // DEBUG
        console.log('\t socket.io:: client disconnected ' + client.userid + ' ' + client.game_id);
        
        // if client was in a game
        if (client.game && client.game.id) {
            //player leaving a game should destroy that game ? DEBUG
            game_server.endGame(client.game.id, client.userid);
        } //client.game_id

    }); //client.on disconnect
 
}); //sio.sockets.on connection

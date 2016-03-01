/* Andy Yu
*/

    var game_server = module.exports = { games: {}, game_count: 0 },
        UUID        = require('node-uuid'),
        verbose     = true;

    //Since we are sharing code with the browser, we
    //are going to include some values to handle that.
    global.window = global.document = global;

    // import shared game logic
    require('../public/js/game.core.js');

    // wrapper for logging
    game_server.log = function() {
        if (verbose) console.log.apply(this, arguments);
    };

    game_server.local_time = 0;
    game_server._dt = new Date().getTime();
    game_server._dte = new Date().getTime();

    setInterval(function(){
        game_server._dt = new Date().getTime() - game_server._dte;
        game_server._dte = new Date().getTime();
        game_server.local_time += game_server._dt/1000.0;
    }, 4);

    game_server.onMessage = function(client, message) {

        // split up message
        var message_parts = message.split('.');

        // first part of message is the type
        var message_type = message_parts[0];

        var other_client =
            (client.game.player_host.userid == client.userid) ?
                client.game.player_client : client.game.player_host;

        if (message_type == 'i') {
            // key input
            this.onInput(client, message_parts);
        } else if (message_type == 'p') {
            client.send('s.p.' + message_parts[1]);
        } else if(message_type == 'c') {
            // changed color
            if(other_client)
                other_client.send('s.c.' + message_parts[1]);
        }

    }; //game_server.onMessage

    game_server.onInput = function(client, parts) {
        // split the input into seperate commands
        var input_commands = parts[1].split('-');
        var input_time = parts[2].replace('-','.');
        var input_seq = parts[3];

        // if the client is in a game, handle the input command
        if(client && client.game && client.game.gamecore) {
            client.game.gamecore.handle_server_input(client, input_commands, input_time, input_seq);
        }

    }; //game_server.onInput



    // Essential game instance creation / deletion / search

    game_server.createGame = function(player) {

        // create new game instance
        var new_game = {
                id: UUID(),                // generate id for game
                player_host: player,
                player_client: null,       
                player_count: 1           
            };

        // add it to list of games
        this.games[new_game.id] = new_game;

        // increment number of games
        this.game_count++;

        // new game core instance, runs main game code
        new_game.gamecore = new game_core(new_game);

        // start updating game loop on server
        new_game.gamecore.update(new Date().getTime());

        /**
         * tell player that they are host
         * s = server message, h = you are hosting
         */
        player.send('s.h.'+ String(new_game.gamecore.local_time).replace('.','-'));
        console.log('server host at  ' + new_game.gamecore.local_time);
        player.game = new_game;
        player.hosting = true;
        
        this.log('player ' + player.userid + ' created a game with id ' + player.game.id);

        return new_game;

    }; //game_server.createGame


    // kill a game currently in progress
    game_server.endGame = function(gameid, userid) {

        var dead_game = this.games[gameid];

        if (dead_game) {
            // stop game updates
            dead_game.gamecore.stop_update();

            // if the game has two players, the one is leaving
            if (dead_game.player_count > 1) {
                // send the players the message the game is ending
                if (userid == dead_game.player_host.userid) {
                    // the host left
                    if (dead_game.player_client) {
                        // s = server message, e = game ending
                        dead_game.player_client.send('s.e');
                    
                        // find new game for player
                        this.findGame(dead_game.player_client);
                    }
                } else {
                    // the other player left, we were hosting
                    if (dead_game.player_host) {
                        // tell the host that the game is ending
                        dead_game.player_host.send('s.e');
                        dead_game.player_host.hosting = false;
                        
                        // host now loooks for a new game
                        this.findGame(dead_game.player_host);
                    }
                }
            }

            delete this.games[gameid];
            this.game_count--;

            this.log('game removed. there are now ' + this.game_count + ' games' );

        } else {
            this.log('that game was not found!');
        }

    }; //game_server.endGame

    game_server.startGame = function(game) {

            //right so a game has 2 players and wants to begin
            //the host already knows they are hosting,
            //tell the other client they are joining a game
            //s=server message, j=you are joining, send them the host id
        game.player_client.send('s.j.' + game.player_host.userid);
        game.player_client.game = game;

            //now we tell both that the game is ready to start
            //clients will reset their positions in this case.
        game.player_client.send('s.r.'+ String(game.gamecore.local_time).replace('.','-'));
        game.player_host.send('s.r.'+ String(game.gamecore.local_time).replace('.','-'));
 
            //set this flag, so that the update loop can run it.
        game.active = true;

    }; //game_server.startGame

    game_server.findGame = function(player) {

        this.log('looking for a game. We have : ' + this.game_count);

        // if there are other games active, see if any need another player
        if (this.game_count) {
                
            var joined_a_game = false;

                //Check the list of games for an open game
            for(var gameid in this.games) {
                    //only care about our own properties.
                if(!this.games.hasOwnProperty(gameid)) continue;
                    //get the game we are checking against
                var game_instance = this.games[gameid];

                    //If the game is a player short
                if(game_instance.player_count < 2) {

                        //someone wants us to join!
                    joined_a_game = true;
                        //increase the player count and store
                        //the player as the client of this game
                    game_instance.player_client = player;
                    game_instance.gamecore.players.other.instance = player;
                    game_instance.player_count++;

                        //start running the game on the server,
                        //which will tell them to respawn/start
                    this.startGame(game_instance);

                } //if less than 2 players
            } //for all games

                //now if we didn't join a game,
                //we must create one
            if(!joined_a_game) {

                this.createGame(player);

            } //if no join already

        } else { //if there are any games at all

                //no games? create one!
            this.createGame(player);
        }

    }; //game_server.findGame


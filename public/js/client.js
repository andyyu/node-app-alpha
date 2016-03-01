/*  Andy Yu
*/

// window global for our game variable
var game = {};

// client stores references to the canvas and creates a new game instance
window.onload = function(){

  // create a new game client instance
  game = new game_core();

      //Fetch the viewport
    game.gameview = document.getElementById('game-view');
      
      //Adjust their size
    game.gameview.width = game.world.width;
    game.gameview.height = game.world.height;

      //Fetch the rendering contexts
    game.ctx = game.gameview.getContext('2d');

      //Set the draw style for the font
    game.ctx.font = '11px "Helvetica"';

    //Finally, start the loop
  game.update( new Date().getTime() );

}; //window.onload
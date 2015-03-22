angular.module('myApp', [])
  .controller('Ctrl',
    ['$translate', '$scope', '$log', 'resizeGameAreaService', 'realTimeService',
      function ($translate, $scope, $log, resizeGameAreaService, realTimeService) {
  'use strict';

  resizeGameAreaService.setWidthToHeight(1);

  var isGameOngoing = false;
  var isSinglePlayer = false;
  var playersInfo = null;
  var yourPlayerIndex = null;

  // Game state
  var allSnakes; // allSnakes[playerIndex]  is the snake of playerIndex
  var snake_array; // points to allSnakes[yourPlayerIndex]
  var allScores;
  var foodCreatedNum; // Number of food pieces that were created (a food piece should be eaten by one player only).
  var d; //Direction: "right", "left", "up", "down"
  var food; // {x: ..., y: ...}
  var startMatchTime; // For displaying a countdown.

  function gotStartMatch(params) {
    yourPlayerIndex = params.yourPlayerIndex;
    playersInfo = params.playersInfo;
    Math.seedrandom(params.matchId); // so all players will see the food in the same place.
    isGameOngoing = true;
    isSinglePlayer = playersInfo.length === 1;

    foodCreatedNum = 0;
    allSnakes = [];
    allScores = [];
    for (var index = 0; index < playersInfo.length; index++) {
      allSnakes[index] = create_snake(index);
      allScores[index] = 0;
    }
    snake_array = allSnakes[yourPlayerIndex];
    create_food();
    d = "right"; //default direction
    startMatchTime = new Date().getTime();
    setDrawInterval();
  }

  function gotMessage(params) {
    var fromPlayerIndex = params.fromPlayerIndex;
    var messageString = params.message;
    // {f: foodCreatedNum, s: score, a: snake_array}
    // The array representing the cells of a player's snake.
    var messageObject = angular.fromJson(messageString);
    allSnakes[fromPlayerIndex] = messageObject.a;
    allScores[fromPlayerIndex] = messageObject.s;
    while (foodCreatedNum < messageObject.f) {
      create_food();
    }
  }

  function gotEndMatch(endMatchScores) {
    allScores = endMatchScores;
    isGameOngoing = false;
    stopDrawInterval();
  }

  function sendMessage(isReliable) {
    if (isSinglePlayer || !isGameOngoing) {
      return; // You shouldn't send messages if you're the only player
    }
    var messageString = angular.toJson(
        {f: foodCreatedNum, s: allScores[yourPlayerIndex], a: snake_array});
    if (isReliable) {
      realTimeService.sendReliableMessage(messageString);
    } else {
      realTimeService.sendUnreliableMessage(messageString);
    }
  }

  function lostMatch() {
    if (!isGameOngoing) {
      return;
    }
    isGameOngoing = false;
    realTimeService.endMatch(allScores);
  }

  realTimeService.setGame({
    gotStartMatch: gotStartMatch,
    gotMessage: gotMessage,
    gotEndMatch: gotEndMatch
  });


	//Canvas stuff
	var canvas = document.getElementById("canvas");
	var ctx = canvas.getContext("2d");
  // Constants
	var w = 300;
	var h = 300;
	//Lets save the cell width in a variable for easy control
	var cw = 10;
  var drawEveryMilliseconds = 100;

  // Colors:
  // black: canvas borders
  // white: canvas background
  // green: food
  var playerSnakeColor = [
    'blue', 'red', 'brown', 'purple', 'pink',
    'purple', 'orange', 'silver', 'yellow', 'cyan'
  ];

  var drawInterval;

  function setDrawInterval() {
    stopDrawInterval();
    // Every 3 food pieces we increase the snake speed (to a max of 30ms interval).
    var intervalMillis = Math.max(30, drawEveryMilliseconds - 10 * Math.floor(foodCreatedNum / 3));
    drawInterval = setInterval(updateAndDraw, intervalMillis);
  }

  function stopDrawInterval() {
    clearInterval(drawInterval);
  }

	function create_snake(playerIndex)
	{
		var length = 5; // Initial length of the snake
		var arr = []; //Empty array to start with
		for(var i = length-1; i>=0; i--) {
			//This will create a horizontal snake starting from the top left
			arr.push({x: i, y: playerIndex - Math.floor(playersInfo.length / 2) + w / cw / 2});
		}
    return arr;
	}

	//Lets create the food now
	function create_food()
	{
		food = {
			x: Math.round(Math.random()*(w-cw)/cw),
			y: Math.round(Math.random()*(h-cw)/cw),
		};
    foodCreatedNum++;
	}

	function updateAndDraw()
	{
    if (!isGameOngoing) {
      return;
    }
    var secondsFromStart =
      Math.floor((new Date().getTime() - startMatchTime) / 1000);
    if (secondsFromStart < 3) {
      // Countdown to really start
      changeDirQueue = []; // Clear any direction changes in the queue
      draw();
      // Draw countdown
      var secondsToReallyStart = 3 - secondsFromStart;

      // Gives you a hint what is your color
      var yourColor = playerSnakeColor[yourPlayerIndex];
      ctx.fillStyle = yourColor;
      ctx.font = '80px sans-serif';
      ctx.fillText("" + secondsToReallyStart, w / 2, h / 2);

      ctx.font = '20px sans-serif';
      var msg = $translate.instant("YOUR_SNAKE_COLOR_IS",
          {color: $translate.instant(yourColor.toUpperCase())});
      ctx.fillText(msg, w / 4 - 30, h / 4 - 30);
      return;
    }

    changeDirection();

		//The movement code for the snake to come here.
		//The logic is simple
		//Pop out the tail cell and place it infront of the head cell
		var nx = snake_array[0].x;
		var ny = snake_array[0].y;
		//These were the position of the head cell.
		//We will increment it to get the new head position
		//Lets add proper direction based movement now
		if (d === "right") {
      nx++;
		} else if (d === "left") {
      nx--;
		} else if (d === "up") {
      ny--;
    } else if (d === "down") {
      ny++;
    }

		//Lets add the game over clauses now
		//This will restart the game if the snake hits the wall
		//Lets add the code for body collision
		//Now if the head of the snake bumps into its body, the game will restart
		if (nx === -1 || nx === w/cw || ny === -1 || ny === h/cw ||
        check_collision(nx, ny, snake_array)) {
      lostMatch();
			return;
		}

		//Lets write the code to make the snake eat the food
		//The logic is simple
		//If the new head position matches with that of the food,
		//Create a new head instead of moving the tail
    var isReliable = true; // If creating food (and increasing score), I want to pass the message reliably.
		var tail;
    if(nx === food.x && ny === food.y) {
      isReliable = false;
			tail = {x: nx, y: ny};
      allScores[yourPlayerIndex]++;
			//Create new food
			create_food();
		} else {
			tail = snake_array.pop(); //pops out the last cell
			tail.x = nx; tail.y = ny;
		}
		//The snake can now eat the food.

		snake_array.unshift(tail); //puts back the tail as the first cell

    sendMessage(isReliable);
    draw();
  }

  function draw() {
    //To avoid the snake trail we need to paint the BG on every frame
    //Lets paint the canvas now
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "black";
    ctx.strokeRect(0, 0, w, h);

    var i;
    for (i = 0; i < allSnakes.length; i++) {
      if (i !== yourPlayerIndex) {
        drawSnake(allSnakes[i], i);
      }
    }
    // Your snake is always drawn last (so it will be completely visible).
    drawSnake(snake_array, yourPlayerIndex);

		//Lets paint the food
		paint_cell(food.x, food.y, 'green');
		//Lets paint the score
		for (i = 0; i < allScores.length; i++) {
      ctx.font = '12px sans-serif';
      var color = playerSnakeColor[i];
      ctx.fillStyle = color;
      var msg = $translate.instant("COLOR_SCORE_IS",
          {color: $translate.instant(color.toUpperCase()), score: "" + allScores[i]});
  		ctx.fillText(msg,
          5 + i * w / playersInfo.length, h-5);
    }
	}

  function drawSnake(snake, playerIndex) {
    for(var i = 0; i < snake.length; i++) {
      var c = snake[i];
      paint_cell(c.x, c.y, playerSnakeColor[playerIndex]);
    }
  }

	function paint_cell(x, y, color)
	{
		ctx.fillStyle = color;
		ctx.fillRect(x*cw, y*cw, cw, cw);
		ctx.strokeStyle = "white";
		ctx.strokeRect(x*cw, y*cw, cw, cw);
	}

	function check_collision(x, y, array)
	{
		//This function will check if the provided x/y coordinates exist
		//in an array of cells or not
		for(var i = 0; i < array.length; i++) {
			if(array[i].x === x && array[i].y === y) {
			  return true;
      }
		}
		return false;
	}


  function changeDirection() {
    var key = changeDirQueue.shift();
    if (!key) {
      return;
    }
    if(key === "left" && d !== "right") {
      d = "left";
    } else if(key === "up" && d !== "down") {
      d = "up";
    } else if(key === "right" && d !== "left") {
      d = "right";
    } else if(key === "down" && d !== "up") {
      d = "down";
    }
  }

  var changeDirQueue = [];
  function addChangeDir(dir) {
    if (changeDirQueue.length > 0 && changeDirQueue[changeDirQueue.length - 1] === dir) {
      return;
    }
    changeDirQueue.push(dir);
  }

	//Lets add the keyboard controls now
  document.addEventListener("keydown", function(e){
		var key = e.which;
    var dir = key === 37 ? "left"
        : key === 38 ? "up"
        : key === 39 ? "right"
        : key === 40 ? "down" : null;
    if (dir !== null) {
	    addChangeDir(dir);
    }
	}, false);

  var lastX = null, lastY = null;
  function processTouch(e) {
    e.preventDefault(); // prevent scrolling when inside DIV
    var touchobj = e.changedTouches[0];
    var distX = touchobj.pageX - lastX; // get horizontal dist traveled by finger while in contact with surface
    var distY = touchobj.pageY - lastY; // get vertical dist traveled by finger while in contact with surface
    var swipedir = null;
    var absDistX = Math.abs(distX);
    var absDistY = Math.abs(distY);
    if (absDistX >= 20 || absDistY >= 20) {
      lastX = touchobj.pageX;
      lastY = touchobj.pageY;
      if (absDistX > absDistY) {
        swipedir = distX < 0 ? 'left' : 'right';
      } else {
        swipedir = distY < 0 ? 'up' : 'down';
      }
      addChangeDir(swipedir);
    }
  }
  canvas.addEventListener('touchstart', function(e) {
    var touchobj = e.changedTouches[0];
    lastX = touchobj.pageX;
    lastY = touchobj.pageY;
    e.preventDefault();
  }, false);
  canvas.addEventListener('touchmove', function(e) {
    processTouch(e);
  }, false);
  canvas.addEventListener('touchend', function(e) {
    processTouch(e);
  }, false);
}])
.config(['$translateProvider', function($translateProvider) {
  'use strict';

  if (!window.angularTranslations) {
    throw new Error("We forgot to include languages/en.js in our HTML");
  }
  $translateProvider.translations('en', window.angularTranslations);
  $translateProvider.useStaticFilesLoader({
      prefix: 'languages/',
      suffix: '.js'
    })
    .registerAvailableLanguageKeys(['en', 'he'])
    .fallbackLanguage(['en'])
    .determinePreferredLanguage();
}]);

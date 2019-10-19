var app = require("express")();
var server = require("http").Server(app);
const cors = require("cors");
require("dotenv").config();
const { PORT, CLIENT_ORIGIN } = require("./config");
const bodyParser = require("body-parser");
app.use(
  cors({
    origin: [CLIENT_ORIGIN]
  })
);
app.use(bodyParser.json());
const io = require("socket.io")(server);

// io.of('bop')

io.on("connection", socket => {
  console.log("Player Connected to App");

  io.emit("playerCount", countPlayers());
  socket.emit("roomList", listRooms());

  socket.on("disconnect", () => {
    console.log("Player Disconnected from App");
    io.emit("playerCount", countPlayers());
  });

  socket.on("roomRefresh", () => {
    console.log("Sending Update");
    socket.emit("roomList", listRooms());
    socket.emit("playerCount", countPlayers());
  });

  socket.on("create", roomName => {
    console.log(`Player Created ${roomName} Room`);

    // create room
    io.of(roomName).on("connection", roomSocket => {
      console.log(`Player Connected to ${roomName}`);
      let players = Object.keys(roomSocket.adapter.sids).length;
      io.of(roomName).emit("playerCount", players);

      if (players === 1) {
        console.log("first");
        roomSocket.emit("playerAssign", "X");
      } else if (players === 2) {
        console.log("second");
        roomSocket.emit("playerAssign", "O");
      } else {
        roomSocket.emit("playerAssign", "Spectator");
        console.log("spectator");
      }

      roomSocket.on("disconnect", () => {
        console.log(`Player Disconnected from ${roomName}`);
      });

      roomSocket.on("boxChecked", data => {
        console.log(`Box Checked from ${roomName}`);
        data.copy[data.box].player = data.turn;
        io.of(roomName).emit("gameUpdate", {
          winner: checkForWinner(data),
          boxes: data.copy,
          turn: data.turn === "X" ? "O" : "X",
          spaces: data.spaces - 1
        });
      });

      roomSocket.on("gameReset", () => {
        console.log(`Player Reset ${roomName}`);
        io.of(roomName).emit("gameUpdate", {
          boxes: [
            { player: null },
            { player: null },
            { player: null },
            { player: null },
            { player: null },
            { player: null },
            { player: null },
            { player: null },
            
            { player: null }
          ],
          turn: "X",
          spaces: 9,
          winner: false
        });
      });
    });

    // update everyone's room list
    io.emit("roomCreated", listRooms());
  });
});

function checkForWinner(data) {
  console.log(`Checking ${data.turn} move`);
  let winStr = `${data.turn}${data.turn}${data.turn}`;
  let paths = [
    [2, 5, 8],
    [1, 4, 7],
    [0, 3, 6],
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];
  // for each path
  for (let i = 0; i < paths.length; i++) {
    // go through each box value and add to checkStr
    let checkStr = "";
    for (let x = 0; x < paths[i].length; x++) {
      console.log(data.copy[paths[i][x]].player);
      checkStr += data.copy[paths[i][x]].player
        ? data.copy[paths[i][x]].player
        : "";
    }
    // if it matches winStr - alert winner
    console.log(checkStr, winStr);

    if (checkStr === winStr) {
      console.log("WINNER", paths[i]);
      return true;
    }
  }
  return false;
}

// returns list of room names
function listRooms() {
  let rooms = Object.keys(io.nsps);
  let filteredRooms = rooms.map(room => {
    // removing "/" from room name
    return room.slice(1);
  });
  //   removing the main room name "/" from start of array
  return filteredRooms.slice(1);
}

function countPlayers() {
  return Object.keys(io.sockets.sockets).length;
}

server
  .listen(PORT, () => {
    console.log(`Your app is listening on port ${PORT}`);
  })
  .on("error", err => {
    console.log(err);
  });

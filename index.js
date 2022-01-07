// server.js
// where your node app starts

// init project
const express = require("express");
const app = express();
const rooms = new Map();

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/views/index.html");
});

app.get("/*", (req, res) => {
	res.sendFile(__dirname + "/views/board.html");
});

const server = app.listen(3000);
const io = require("socket.io")(server);

io.on("connection", (socket) => {
	const room = () => [...socket.rooms][1];
	const { id } = socket;
	socket.on("join", (msg) => {
		socket.join(msg);
		if(rooms.has(msg)) {
			for(let ev of rooms.get(msg)) socket.emit(...ev);
		} else {
			rooms.set(msg, []);
		}
		socket.emit("sync");
	});
	socket.on("sync", () => {
		if(rooms.has(room())) {
			for(let ev of rooms.get(room())) socket.emit(...ev);
		}
		socket.emit("sync");
	});
	socket.on("disconnect", (msg) => emit("gc", id));
	socket.on("drawmove", (msg) => emit("drawmove", { ...msg, id }));
	socket.on("drawstart", (msg) => emit("drawstart", { ...msg, id }));
	socket.on("drawend", (msg) => emit("drawend", { ...msg, id }));

	function emit(...args) {
		io.to(room()).emit(...args);
		if(rooms.has(room())) rooms.get(room()).push(args);
	}
});

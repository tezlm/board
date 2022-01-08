// server.js
// where your node app starts

// init project
const express = require("express");
const app = express();
const rooms = new Map();

app.use(express.static(__dirname + "/public"));

app.get("/", (_, res) => {
	const consonants = "bcdfghjklmnpqrstvwxyz";
	const vowels = "aeiou";
	const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
	let word = "";
	for (let i = 0; i < Math.random() * 2 + 2; i++) {
		word += rnd(consonants);
		word += rnd(vowels);
	}
	res.redirect("/" + word);
});

app.get("/*", (_, res) => {
	res.sendFile(__dirname + "/board.html");
});

const server = app.listen(process.env.PORT || 3000);
const io = require("socket.io")(server);

io.on("connection", (socket) => {
	const room = () => [...socket.rooms][1];
	const { id } = socket;
	socket.on("join", (msg) => {
		socket.join(msg);
		if(!rooms.has(msg)) rooms.set(msg, []);
		socket.emit("sync", rooms.get(msg));
	});

	socket.on("draw", (msg) => {
		msg = { ...msg, id };
		io.to(room()).emit("draw", msg);
		if(rooms.has(room()) && !msg.drop) rooms.get(room()).push(msg);
	});
});

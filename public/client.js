const $ = e => document.getElementById(e);
const socket = io();
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const peers = new Map();
let penColor = "black";

const colors = document.querySelectorAll(".picker button");
let colorel = colors[Math.floor(Math.random() * colors.length)];
select(colorel);

for (let el of colors) {
	el.addEventListener("click", () => select(el));
	el.style.background = el.id;
}

function select(el) {
	penColor = el.id;
	if (colorel) colorel.classList.remove("selected");
	el.classList.add("selected");
	colorel = el;
}

ctx.lineCap = "round";
ctx.lineJoin = "round";

canvas.addEventListener("mousedown", mousedown);
canvas.addEventListener("mouseup", mouseup);
canvas.addEventListener("mousemove", mousemove);
canvas.addEventListener("touchstart", mousedown);
canvas.addEventListener("touchmove", mousemove);
canvas.addEventListener("touchend", mouseup);
canvas.addEventListener("touchcancel", mouseup);
window.addEventListener("resize", resize);
document.addEventListener("contextmenu", e => e.preventDefault());

resize();

function resize() {
	canvas.height = window.innerHeight;
	canvas.width = window.innerWidth;
	ctx.height = window.innerHeight;
	ctx.width = window.innerWidth;
	ctx.clearRect(0, 0, 99999, 99999);
	socket.emit("sync");
}

function mousedown(e) {
	e = e.clientX ? e : e.touches[0];
	socket.emit("drawstart", {
		x: e.clientX,
		y: e.clientY,
		color: penColor,
		stroke: penColor === "white" ? 30 : 5,
	});
}

function mousemove(e) {
	e = e.clientX ? e : e.touches[0];
	socket.emit("drawmove", {
		x: e.clientX,
		y: e.clientY,
	});
}

function mouseup(e) {
	e = e.clientX ? e : e.touches[0];
	socket.emit("drawend", {
		x: e.clientX,
		y: e.clientY,
	});
}

socket.on("drawstart", (msg) => {
	const path = new Path2D();
	path.moveTo(msg.x, msg.y);
	peers.set(msg.id, {
		color: msg.color,
		stroke: msg.stroke,
		path,
	});
});

socket.on("drawmove", (msg) => {
	if(!peers.has(msg.id)) return;
	const peer = peers.get(msg.id);
	peer.path.lineTo(msg.x, msg.y);
	ctx.strokeStyle = peer.color;
	ctx.lineWidth = peer.stroke;
	ctx.stroke(peer.path);
});

socket.on("drawend", (msg) => {
	if(!peers.has(msg.id)) return;
	const peer = peers.get(msg.id);
	peer.path.lineTo(msg.x, msg.y);
	ctx.strokeStyle = peer.color;
	ctx.lineWidth = peer.stroke;
	ctx.stroke(peer.path);
	peers.delete(msg.id);
});

socket.on("gc", (id) => {
	peers.delete(id);
});

socket.on("sync", (id) => {
	if($("loading")) $("loading").remove();
});

socket.emit("join", location.pathname);

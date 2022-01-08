const $ = e => document.getElementById(e);
const setStatus = str => $("status").innerText = str;
const socket = io();
const size = 15000;

// someone's (or your) pen
class Pen {
	constructor({ x, y, color = "black", stroke = 5 }) {
		this.startx = x;
		this.starty = y;
		this.color = color;
		this.stroke = stroke;
		this.path = new Path2D();
	}
}

// take in events and process them
class Drawer {
	constructor() {
		this.canvas = new OffscreenCanvas(size, size);
		this.ctx = this.canvas.getContext("2d");
		this.history = [];
		
		// a temporary "staging area" before being drawn to the main canvas
		this.tmpcanvas = new OffscreenCanvas(size, size);
		this.tmpctx = this.canvas.getContext("2d");
		this.tmphistory = [];

		this.pens = new Map();
		this.ctx.lineCap = "round";
		this.ctx.lineJoin = "round";
	}

	chain(event) {
		const { pens, ctx, tmpctx } = this;
		const pen = pens.get(event.id);
		if(event.type === "drawstart") {
			const pen = new Pen(event);
			pen.path.moveTo(pen.startx, pen.starty);
			pens.set(event.id, pen);
		} else if(!pens.has(event.id)) {
			return;
		} else if(event.type === "drawline") {
			// pen.path.lineTo(event.x, event.y);
			// pen.path.moveTo(pen.startx, pen.starty);
			// tmpctx.strokeStyle = pen.color;
			// tmpctx.lineWidth = pen.stroke;
			// tmpctx.stroke(pen.path);
		} else if(event.type === "drawmove" || event.type === "drawend") {
			pen.path.lineTo(event.x, event.y);
			ctx.strokeStyle = pen.color;
			ctx.lineWidth = pen.stroke;
			ctx.stroke(pen.path);
		}
	}

	// tmprender() {
	// 	this.tmpctx.clearRect(0, 0, size, size);
	// }

	// *very* expensive
	render() {
		this.ctx.clearRect(0, 0, size, size);
		for(let event of this.history) this.chain(event);
	}

	add(event) {
		this.history.push(event);
		this.chain(event);
	}
}

// render a drawer to canvas
class Renderer {
	constructor(canvas) {
		this.drawer = new Drawer();
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.pan = [size/-2, size/-2];
		this.resize();
	}

	resize() {
		this.canvas.height = window.innerHeight;
		this.canvas.width = window.innerWidth;
		this.ctx.height = window.innerHeight;
		this.ctx.width = window.innerWidth;
		this.ctx.clearRect(0, 0, size, size);
		this.render();
	}

	add(event) {
		this.drawer.add(event);
		this.render();
	}

	addAll(events) {
		this.drawer.history.push(...events);
		this.drawer.render();
		this.render();
	}

	render() {
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.ctx.clearRect(0, 0, size, size);
		this.ctx.drawImage(this.drawer.canvas, -this.pan[0], -this.pan[1], width, height, 0, 0, width, height);
		// this.ctx.globalAlpha = 0.4;
		// this.ctx.drawImage(this.drawer.tmpcanvas, -this.pan[0], -this.pan[1], width, height, 0, 0, width, height);
		// this.ctx.globalAlpha = 1;
	}
}

// the color selection ui
class ColorSelection {
	constructor(parent) {
		this.parent = parent;
		this.color = "black";
		this.current = null;
		this.elements = [];
	}

	add(color) {
		const button = document.createElement("button");
		button.style.background = color;
		button.addEventListener("click", () => {
			if(this.current) this.current.classList.remove("selected");
			button.classList.add("selected");
			this.color = color;
			this.current = button;
		});
		this.elements.push(button);
		this.parent.append(button);
	}

	addAll(colors) {
		for(let color of colors) this.add(color);
	}

	random() {
		const el = this.elements[Math.floor(Math.random() * this.elements.length)];
		el.click();
	}
}

const cursor = { pressed: false, x: 0, y: 0 };
const renderer = new Renderer($("canvas"));
const colors = new ColorSelection($("picker"));
colors.addAll([
	"#F45B69",
	"#FE7F2D",
	"#FCCA46",
	"#87FF65",
	"#00A5CF",
	"#7D5BA6",
	"#312F2F",
]);
colors.random();
colors.add("white");

function parseType(e) {
	switch(e.type) {
		case "mousedown":
		case "touchstart":
			return "drawstart";
		case "mousemove":
		case "touchmove":
			return "drawmove";
		case "mouseup":
		case "touchend":
			return "drawend";
	}
}

function parseCoords(e) {
	const norm = e.clientX ? e : e.touches?.[0];
	if(!norm) return null;
	return { x: norm.clientX, y: norm.clientY };
}

function parseDrawEvent(coords, type) {
	const x = coords.x - renderer.pan[0];
	const y = coords.y - renderer.pan[1];
	if(type === "drawstart") {
		if(cursor.pressed) return null;
		return {
			type, x, y,
			color: colors.color,
			stroke: colors.color === "white" ? 30 : 5,
		};
	} else {
		if(!cursor.pressed) return null;
		return { type, x, y };
	}
}

function handle(e) {
	const coords = parseCoords(e);
	if(!coords) return;
	const type = parseType(e);
	if(e.which === 1) {
		if(e.shiftKey) {
			setStatus("line");
			const event = parseDrawEvent(coords, type, e);
			if(!event) return;
			renderer.add(event);
			socket.emit("draw", event);
		} else {
			setStatus("drawing");
			const event = parseDrawEvent(coords, type, e);
			if(!event) return;
			renderer.add(event);
			socket.emit("draw", event);
		}
	} else if(cursor.pressed && e.which === 2) {
		setStatus("panning");
		renderer.pan[0] += coords.x - cursor.x;
		renderer.pan[1] += coords.y - cursor.y;
		renderer.render();
	}
	if(type === "drawstart") cursor.pressed = true;
	if(type === "drawend") {
		setStatus("ready");
		cursor.pressed = false;
	}

	cursor.x = coords.x;
	cursor.y = coords.y;
}

socket.on("draw", (event) => {
	if(socket.id === event.id) return;
	renderer.add(event);
});

socket.on("sync", (data) => {
	renderer.addAll(data);
	if($("loading")) $("loading").remove();
	setStatus("ready");
});

socket.on("connect", () => {
	socket.emit("join", location.pathname);
});

const canvas = $("canvas");
canvas.addEventListener("mousedown", handle);
canvas.addEventListener("mouseup", handle);
canvas.addEventListener("mousemove", handle);
canvas.addEventListener("touchstart", handle);
canvas.addEventListener("touchmove", handle);
canvas.addEventListener("touchend", handle);
canvas.addEventListener("touchcancel", handle);
window.addEventListener("resize", () => renderer.resize());


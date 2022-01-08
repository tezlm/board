const $ = e => document.getElementById(e);
const setStatus = str => $("status").innerText = str;
const socket = io();
const size = 15000;

class Drawer {
	constructor() {
		this.canvas = new OffscreenCanvas(size, size);
		this.ctx = this.canvas.getContext("2d");
		this.history = [];
		this.pens = new Map();
	
		this.ctx.lineCap = "round";
		this.ctx.lineJoin = "round";
	}

	chain(event) {
		const { pens } = this;
		if(event.type === "drawstart") {
			const path = new Path2D();
			path.moveTo(event.x, event.y);
			pens.set(event.id, { ...event, path });
		} else if(event.type === "drawmove") {
			if(!pens.has(event.id)) return;
			const pen = pens.get(event.id);
			pen.path.lineTo(event.x, event.y);
			this.ctx.strokeStyle = pen.color;
			this.ctx.lineWidth = pen.stroke;
			this.ctx.stroke(pen.path);
		} else if(event.type === "drawend") {
			if(!pens.has(event.id)) return;
			const pen = pens.get(event.id);
			pen.path.lineTo(event.x, event.y);
			this.ctx.strokeStyle = pen.color;
			this.ctx.lineWidth = pen.stroke;
			this.ctx.stroke(pen.path);
		}
	}

	render() {
		this.ctx.clearRect(0, 0, size, size);
		for(let event of this.history) this.chain(event);
	}

	add(event) {
		for(let i = this.history.length - 1; i > 0; i--) {
			if(this.history[i].id === event.id) {
				if(!this.history[i].save) this.history.splice(i, 1);
				break;
			}
		}
		this.history.push(event);
		this.chain(event);
	}
}

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
		this.ctx.clearRect(0, 0, 99999, 99999);
		this.ctx.drawImage(this.drawer.canvas, this.pan[0], this.pan[1]);
	}
}

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
	if(type === "drawstart") {
		if(cursor.pressed) return null;
		return {
			type,
			save: true,
			x: coords.x - renderer.pan[0],
			y: coords.y - renderer.pan[1],
			color: colors.color,
			stroke: colors.color === "white" ? 30 : 5,
		};
	} else {
		if(!cursor.pressed) return null;
		return {
			type,
			save: true,
			x: coords.x - renderer.pan[0],
			y: coords.y - renderer.pan[1],
		};

	}
}

function handle(e) {
	const coords = parseCoords(e);
	if(!coords) return;
	const type = parseType(e);
	if(e.which === 1) {
		setStatus("drawing");
		const event = parseDrawEvent(coords, type);
		if(!event) return;
		renderer.add(event);
		socket.emit("draw", event);
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


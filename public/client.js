const $ = e => document.getElementById(e);
const setStatus = str => $("status").innerText = str;
const socket = io();

// someone's (or your) pen
class Stroke {
	constructor({ x, y, color = "black", stroke = 5 }) {
		this.color = color;
		this.stroke = stroke;
		this.path = new Path2D();
		this.reset(x, y);
	}

	reset(x, y) {
		for(let i of ["start", "min", "max", "end"]) {
			this[i + "X"] = x;
			this[i + "Y"] = y;
		}
		this.path.moveTo(x, y);
	}

	add(x, y) {
		this.path.lineTo(x, y);
		if(x < this.minX) this.minX = x;
		if(y < this.minY) this.minY = y;
		if(x > this.maxX) this.maxX = x;
		if(y > this.maxY) this.maxY = y;
		this.endX = x;
		this.endY = y;
	}

	line(x, y) {
		this.path = new Path2D();
		this.reset(this.startX, this.startY);
		this.add(x, y);
	}

	intersect(rect) {
		if(this.minX > rect.x + rect.width) return false;
		if(this.minY > rect.y + rect.height) return false;
		if(this.maxX < rect.x) return false;
		if(this.maxY < rect.y) return false;
		return true;
	}
}

// render a drawer to canvas
class Renderer {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.pan = [0, 0];
		this.scale = 1;

		// drawing
		this.strokes = new Map();
		this.history = [];

		// init canvas
		this.ctx.lineCap = "round";
		this.ctx.lineJoin = "round";
		this.resize();
	}

	panBy(x, y) {
		this.pan[0] += x;
		this.pan[1] += y;
		this.ctx.translate(x, y);
	}

	resize() {
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.canvas.height = height; 
		this.canvas.width = width;
		this.ctx.height = height;
		this.ctx.width = width;
		this.ctx.clearRect(0, 0, width, height);
		this.redraw();
	}

	stroke(stroke) {
		const { ctx } = this;
		ctx.strokeStyle = stroke.color;
		ctx.lineWidth = stroke.stroke;
		ctx.stroke(stroke.path);
	}

	add(event) {
		const { strokes } = this;
		const stroke = strokes.get(event.id);
		if(event.type === "drawstart") {
			const stroke = new Stroke(event);
			strokes.set(event.id, stroke);
		} else if(!strokes.has(event.id)) {
			return;
		} else if(event.type === "drawline") {
			this.redraw();
			stroke.line(event.x, event.y);
			this.stroke(stroke);
		} else if(event.type === "drawmove" || event.type === "drawend") {
			stroke.add(event.x, event.y);
			this.stroke(stroke);
			if(event.type === "drawend") this.history.push(stroke);
		}
	}

	addAll(events) {
		for(let event of events) this.add(event);
	}

	redraw() {
		const { ctx } = this;
		const width = window.innerWidth;
		const height = window.innerHeight;
		const rect = { x: -this.pan[0], y: -this.pan[1], width, height };
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, width, height);
		ctx.translate(this.pan[0], this.pan[1]);
		for(let stroke of this.history) {
			if(stroke.intersect(rect)) this.stroke(stroke);
		}
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
	"#F45B69", // red
	"#FE7F2D", // orange
	"#FCCA46", // yellow
	"#87FF65", // green
	"#00A5CF", // blue
	"#7D5BA6", // purple
	"#312F2F", // black
	"#424B54", // gray
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
		setStatus(e.shiftKey ? "line" : "drawing");
		const event = parseDrawEvent(coords, type);
		if(!event) return;
		if(e.shiftKey && type === "drawmove") event.type = "drawline";
		renderer.add(event);
		socket.emit("draw", event);
	} else if(e.which === 2) {
		setStatus("panning");
		renderer.panBy(coords.x - cursor.x, coords.y - cursor.y);
		renderer.redraw();
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


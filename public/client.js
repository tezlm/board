const $ = e => document.getElementById(e);
const socket = io();

class Drawer {
	constructor() {
		this.canvas = new OffscreenCanvas(1e4, 1e4);
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
		this.ctx.clearRect(0, 0, 1e9, 1e9);
		for(let event of this.history) this.chain(event);
	}

	add(event) {
		this.history.push(event);
		this.chain(event);
	}
}

class Renderer {
	constructor(canvas) {
		this.drawer = new Drawer();
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.pan = [0, 0];
		this.resize();
	}

	resize() {
		this.canvas.height = window.innerHeight;
		this.canvas.width = window.innerWidth;
		this.ctx.height = window.innerHeight;
		this.ctx.width = window.innerWidth;
		this.ctx.clearRect(0, 0, 99999, 99999);
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

let pressed = false;
function mousedown(e) {
	e = e.clientX ? e : e.touches?.[0];
	if(!e) return;
	pressed = true;
	if(e.which !== 1) return;
	const event = {
		type: "drawstart",
		x: e.clientX - renderer.pan[0],
		y: e.clientY - renderer.pan[1],
		color: colors.color,
		stroke: colors.color === "white" ? 30 : 5,
	};
	renderer.add(event);
	socket.emit("draw", event);
}

function mousemove(e) {
	if(!pressed) return;
	e = e.clientX ? e : e.touches?.[0];
	if(!e) return;
	if(e.which !== 1) {
		renderer.pan[0] += e.movementX;
		renderer.pan[1] += e.movementY;
		renderer.render();
		return;
	}
	const event = {
		type: "drawmove",
		x: e.clientX - renderer.pan[0],
		y: e.clientY - renderer.pan[1],
	};
	renderer.add(event);
	socket.emit("draw", event);
}

function mouseup(e) {
	e = e.clientX ? e : e.touches?.[0];
	if(!e) return;
	pressed = false;
	if(e.which !== 1) return;
	const event = {
		type: "drawend",
		x: e.clientX - renderer.pan[0],
		y: e.clientY - renderer.pan[1],
	};
	renderer.add(event);
	socket.emit("draw", event);
}

socket.on("draw", (event) => {
	if(socket.id === event.id) return;
	renderer.add(event);
});

socket.on("sync", (data) => {
	renderer.addAll(data);
	if($("loading")) $("loading").remove();
});

socket.on("connect", () => {
	socket.emit("join", location.pathname);
});

const canvas = $("canvas");
canvas.addEventListener("mousedown", mousedown);
canvas.addEventListener("mouseup", mouseup);
canvas.addEventListener("mousemove", mousemove);
canvas.addEventListener("touchstart", mousedown);
canvas.addEventListener("touchmove", mousemove);
canvas.addEventListener("touchend", mouseup);
canvas.addEventListener("touchcancel", mouseup);
window.addEventListener("resize", renderer.resize);


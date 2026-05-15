// ==UserScript==
// @name         OIC Timetable
// @namespace    http://tampermonkey.net/
// @require      https://unpkg.com/ical.js@2.1.0/dist/ical.es5.min.cjs
// @require      https://cdn.jsdelivr.net/npm/chart.js
// @version      2026-05-15
// @description  Make it easy to check which rooms are booked at the JKU OIC.
// @author       Felix Schmid
// @match        https://gwcal.jku.at/gw/webacc
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
	'use strict';

const roomdata = {
	"rooms": [
		{"name": "Merkur", "building": 0, "capacity": 4, "color": "#8c8a89",
			"id": "b2ljX21lcmt1ckBqa3UuYXQ_Y249Q2FsZW5kYXI"},
		{"name": "Venus", "building": 0, "capacity": 4, "color": "#dab292",
			"id": "b2ljX3ZlbnVzQGprdS5hdD9jbj1DYWxlbmRhcg"},
		{"name": "Erde", "building": 0, "capacity": 4, "color": "#6288a8",
			"id": "b2ljX2VyZGVAamt1LmF0P2NuPUNhbGVuZGFy"},
		{"name": "Mars", "building": 0, "capacity": 4, "color": "#f27c5f",
			"id": "b2ljX21hcnNAamt1LmF0P2NuPUNhbGVuZGFy"},
		{"name": "Jupiter", "building": 0, "capacity": 10, "color": "#c08137",
			"id": "b2ljX2p1cGl0ZXJAamt1LmF0P2NuPUNhbGVuZGFy"},
		{"name": "Saturn", "building": 0, "capacity": 10, "color": "#dab778",
			"id": "b2ljX3NhdHVybkBqa3UuYXQ_Y249Q2FsZW5kYXI"},
		{"name": "Uranus", "building": 0, "capacity": 10, "color": "#95bbbe",
			"id": "b2ljX3VyYW51c0Bqa3UuYXQ_Y249Q2FsZW5kYXI"},
		{"name": "Neptun", "building": 0, "capacity": 10, "color": "#7595bf",
			"id": "b2ljX25lcHR1bkBqa3UuYXQ_Y249Q2FsZW5kYXI"},
		{"name": "Bumblebee", "building": 1, "capacity": 10, "color": "#debd45",
			"id": "b2ljX2J1bWJsZWJlZUBqa3UuYXQ_Y249Q2FsZW5kYXI"},
		{"name": "Eve", "building": 1, "capacity": 10, "color": "#4e79e8",
			"id": "b2ljX2V2ZUBqa3UuYXQ_Y249Q2FsZW5kYXI"},
		{"name": "Optimus-Prime", "building": 1, "capacity": 4, "color": "#d04a4a",
			"id": "b2ljX29wdGltdXNfcHJpbWVAamt1LmF0P2NuPUNhbGVuZGFy"},
		{"name": "Seminar-room", "building": 1, "capacity": 20, "color": "#54a348",
			"id": "b2ljX3NlbWluYXItcm9vbUBqa3UuYXQ_Y249Q2FsZW5kYXI"},
		{"name": "Wall-e", "building": 1, "capacity": 10, "color": "#d9884a",
			"id": "b2ljX3dhbGwtZUBqa3UuYXQ_Y249Q2FsZW5kYXI"}
	],
	"buildings": [
		"Erdgeschoss",
		"1. Obergeschoss"
	],
	"bookings": {
	}
};
const baseUrl = "https://gwcal.jku.at/gwcal/calendar/";
const urlArgs = "?Calendar.format=ICS";
const buildings = {};
const usageCharts = {};
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const startTime = 0; // 0:00
const endTime = 1440; // 24:00
const timeStep = 15; // 15min steps
const timeStepSize = 28; // 28px per step
const roomRowHeight = 54;
const buildingRowHeight = 30;
let usageCreated = false;
let lastRefresh;
let timeMarkLine;
let timeDisplay;

const page = `
<!DOCTYPE html>
<html>
<head>
	<title>OIC Timetable</title>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
	<meta name="description" content="Make it easy to check which rooms are booked at the JKU OIC."/>
</head>
<body>
<main>
<style>
/* main menu styling */
body {
	font-family: Arial, sans-serif;
}

main, .chartRegion {
	width: 800px;
	max-width: 100%;
	margin: 0 auto;
}

.chartRegion {
	margin-bottom: 100px;
}

hr {
	color: #e9e9e9;
}

dialog {
	border: none !important;
	border-radius: 10px;
	box-shadow: 0 0 #0000, 0 0 #0000, 0 25px 50px -12px rgba(0, 0, 0, 0.25);
	padding: 1.6rem;
}

.errorcontainer {
	background-color: #ffd3d3;
	border-left: 4px solid #ec5656;
	padding: 8px;
	display: none;
	margin-bottom: 5px;
}

#datepanel {
	display: flex;
	gap: 5px;
	align-items: center;
	margin: 0.83em 0 0.83em 0;
}

#datepanel > h1 {
	margin: 0 10px 0 0;
}

#datepanel input {
	font-weight: bold;
	border: none;
	border-radius: 5px;
	background-color: #e9e9e9;
	padding: 8px;
}

.svgBtn {
	padding: 0;
}

.svgBtn > svg {
	vertical-align: middle;
}

#refreshBtn {
	padding: 4px 8px 4px 4px;
}

#infoBtn {
	background-color: inherit;
	padding: 4px;
}

/* tab control styling */
.tab {
	display: flex;
	background-color: #e9e9e9;
	border-radius: 99px;
	margin: 16px auto;
	width: fit-content;
	box-shadow: 0 0 1px 0 rgba(24, 94, 224, 0.15), 0 6px 12px 0 rgba(24, 94, 224, 0.15);
	gap: 4px;
	padding: 4px;
}

.tab svg {
	vertical-align: middle;
}

button {
	border: none;
	border-radius: 5px;
	cursor: pointer;
	background-color: #e9e9e9;
}

.tab button {
	border-radius: 99px;
	padding: 8px 16px 8px 16px;
}

button:hover {
	background-color: #afc6e8;
}

button:active {
	background-color: #93a7c4;
}

.tab button.tablinkactive {
	background-color: #0d6efd;
	color: white;
}

.tab button.tablinkactive svg {
	filter: invert(100%);
}

.tabcontent {
	display: none;
}

/* table styling */
table {
	border-collapse: collapse;
	margin: 0 auto;
}

tbody > tr:hover { /* for row hover selection */
	background-color: #9ec5fe;
}

thead {
	translate: -14px;
}

tr {
	height: 54px;
}

.buildingTr {
	height: 30px;
}

td {
	position: relative;
	background-size: 112px;
	background-image: linear-gradient(to right, rgb(255, 255, 255) 1px, rgba(200, 200, 200, 0.4) 1px);
	padding: 0;
}

tbody th {
	left: 0;
	padding: 0 10px;
	text-align: right;
	font-weight: normal;
	white-space: nowrap;
}

th {
	position: sticky;
	top: 0;
	min-width: 26px;
	background-color: white;
	z-index: 200;
}

th > small {
	color: #888;
}

.capacity {
	display: inline-block;
	line-height: 24px;
	height: 24px;
	padding-left: 24px;
	background-repeat: no-repeat;
	background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="%23919191"><path d="M367-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/></svg>')
}

#timetable {
	overflow-x: auto;
}

#timeDisplay {
	top: 0;
	border-radius: 0 10px 10px 0;
	position: absolute;
	box-sizing: border-box;
	padding: 5px;
	background-color: #000;
	color: #fff;
	visibility: visible;
}

#timeMarkLine {
	top: 0;
	width: 2px;
	position: absolute;
	background-color: #000;
	z-index: 50;
	visibility: visible;
}

.event {
	top: 4px;
	border-radius: 5px;
	border: 1px solid black;
	position: absolute;
	box-sizing: border-box;
	padding: 5px;
	height: 46px;
	z-index: 100;
}

.event > p {
	margin: 0;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.event > div {
	color: #2c2c2c;
	font-size: 14px;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
</style>
	<dialog id="infos">
		<p>This is an unofficial service, provided without guarantees.</p>
		<p>Results are based on data from <a href="https://gwcal.jku.at/">gwcal.jku.at</a></p>
		<button id="infoCloseBtn" style="padding: 8px;">Close</button>
	</dialog>

	<div id="datepanel">
		<h1>OIC Timetable</h1>

		<button id="prevDayBtn" class="svgBtn" aria-label="previous day"><svg width="28px" height="31px" viewBox="0 -960 960 960"><path d="M560-280 360-480l200-200v400Z"/></svg></button>
		<input type="date" id="dateinput" name="date input"/>
		<button id="nextDayBtn" class="svgBtn" aria-label="next day"><svg width="28px" height="31px" viewBox="0 -960 960 960"><path d="M400-280v-400l200 200-200 200Z"/></svg></button>

		<div style="flex-grow: 1"></div>
		<button id="refreshBtn" class="svgBtn" aria-label="refresh"> <svg width="24px" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg> Updated: <em id="lastRefresh"></em> </button>
		<button id="infoBtn" class="svgBtn" aria-label="info"> <svg width="24px" height="24px" viewBox="0 -960 960 960"><path d="M440-280h80v-240h-80v240Zm68.5-331.5Q520-623 520-640t-11.5-28.5Q497-680 480-680t-28.5 11.5Q440-657 440-640t11.5 28.5Q463-600 480-600t28.5-11.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg> </button>
	</div>

	<div id="inputerror" class="errorcontainer">
		Please select a valid date.
	</div>

	<div id="fetcherror" class="errorcontainer">
		There was an error while fetching calendar data.<br>
		Please ensure that the official service is available
		<a target="_blank" rel="noopener noreferrer" href="https://gwcal.jku.at/gwcal/calendar/b2ljX3VyYW51c0Bqa3UuYXQ_Y249Q2FsZW5kYXI?Calendar.format=html">here</a>,
		and then refresh.<br>
	</div>

	<hr>

	<div class="tab">
		<button id="openTable" class="tablinks">
			<svg width="24px" height="24px" viewBox="0 -960 960 960"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm80 240v-80h400v80H280Zm0 160v-80h280v80H280Z"/></svg>
			Timetable
		</button>
		<button id="openUsage" class="tablinks">
			<svg width="24px" height="24px" viewBox="0 -960 960 960"><path d="m296-320 122-122 80 80 142-141v63h80v-200H520v80h63l-85 85-80-80-178 179 56 56Zm-96 200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>
			Usage Statistics
		</button>
	</div>
</main>

<div id="timetable" class="tabcontent"></div>

<div id="usageStats" class="tabcontent chartRegion"> <!-- per day -->
	<h1 id="usageStatsTitle"> </h1>
	<p id="usageStatsHint"> </p>

	<h2> Most people are here at... </h2>
	<p> Time slots with the most meetings at the same time. </p>
	<canvas id="busyTimeSlots"></canvas>

	<h2> A monthly overview. </h2>
	<p> The total meeting time for each day of the selected month. </p>
	<canvas id="overviewMonth"></canvas>

	<h2> Are all rooms booked out? </h2>
	<p> The rooms with the most meeting hours. </p>
	<canvas id="busyRooms"></canvas>
</div>
</body>
</html>`;

// TODO
// * fix table header row not sticky: table has overflow:auto, which does not work with sticky...
// * show small spinner during refresh: https://cssloaders.github.io/
// * maybe rework fetch for when only some rooms can be loaded
// * shareable deep links (date + tab)

// call init to start all scripts
init();

function init() {
	document.documentElement.replaceChildren();
	document.documentElement.innerHTML = page; // replace page with our own

	// connect event handlers
	document.getElementById("openTable").addEventListener("click", openTab);
	document.getElementById("openTable").tabName = "timetable";
	document.getElementById("openUsage").addEventListener("click", openTab);
	document.getElementById("openUsage").tabName = "usageStats";
	document.getElementById("prevDayBtn").addEventListener("click", selectPrevDay);
	document.getElementById("nextDayBtn").addEventListener("click", selectNextDay);
	document.getElementById("refreshBtn").addEventListener("click", refresh);
	document.getElementById("dateinput").addEventListener("change", dateInputChanged);
	document.getElementById("infoBtn").addEventListener("click", showInfos);
	document.getElementById("infoCloseBtn").addEventListener("click", closeInfos);

	// add keyboard events
	document.addEventListener('keydown', (event) => {
		switch (event.key) {
			case "a": selectPrevDay(); break;
			case "d": selectNextDay(); break;
		}
	});

	createTable();
	const now = new Date();
	document.getElementById("dateinput").valueAsDate = now;
	document.getElementById("openTable").click();

	setInterval(timeTickRefresh, 10000); // refresh shown time every 10s
	refreshData();

	// try to scroll the current time to the center
	const minutes = now.getHours() * 60 + now.getMinutes();
	const width = document.getElementById("timetable").offsetWidth;
	document.getElementById("timetable").scrollLeft = ((minutes - startTime) / timeStep * timeStepSize) - width / 2;
}

/** fetch data from OIC, create table and select today as date */
function refreshData() {
	const fetcherror = document.getElementById("fetcherror");
	fetcherror.style.display = "none";

	lastRefresh = new Date();
	timeTickRefresh(); // immediatly update refresh text
	roomdata.bookings = {}; // clear any previous data
	clearTable(); // remove events from table to indicate refresh
	let nFetched = 0;
	const toFetch = roomdata.rooms.length;

	for (const [key, value] of Object.entries(roomdata.rooms)) {
		fetch(baseUrl + roomdata.rooms[key].id + urlArgs)
			.then(response => {
				if (response.ok) {
					return response.text();
				}
				throw new Error("Could not fetch data");
			})
			.then(data => {
				addEventsFromICS(data, key);
				nFetched++;
				if (nFetched == toFetch) {
					selectDay(document.getElementById("dateinput").value);
				}
			})
			.catch((error) => {
				fetcherror.style.display = "block";
				console.warn("There was an error while parsing data for room " + value.name + ": " + error);
			});
	}
}

function addEventsFromICS(icsData, roomid) {
	const parseRes = ICAL.parse(icsData);
	const comp = new ICAL.Component(parseRes);
	const vevents = comp.getAllSubcomponents("vevent");

	vevents.forEach(event => {
		addBookingEvent(event, roomdata.bookings, roomid);
	});
}

function addBookingEvent(event, bookingsData, roomid) {
	const date = new Date();
	date.setFullYear(date.getFullYear() + 1); // expand max 1 year into future
	const rangeEnd = ICAL.Time.fromJSDate(date);
	const start = event.getFirstPropertyValue("dtstart")

	const expand = new ICAL.RecurExpansion({
		component: event,
		dtstart: start
	});

	let expanded = false;
	let next; // next is always an ICAL.Time or null
	while (next = expand.next()) {
		expanded = true;
		if (next.compare(rangeEnd) > 0) {
			break;
		}
		addBookingTime(next, event, bookingsData, roomid);
	}
	if (!expanded) {
		addBookingTime(start, event, bookingsData, roomid);
	}
}

function addBookingTime(time, event, bookingsData, roomid) {
	const current = time.toJSDate();
	const summary = event.getFirstPropertyValue("summary");

	const start = event.getFirstPropertyValue("dtstart").toJSDate();
	const end = event.getFirstPropertyValue("dtend").toJSDate();
	let duration = (end - start) / (1000 * 60); // ms to minutes

	let currentEnd = new Date(current);
	currentEnd = currentEnd.setMinutes(currentEnd.getMinutes() + duration);

	while (current < currentEnd) {
		const offset = current.getHours() * 60 + current.getMinutes();
		const durationDay = Math.min(duration, endTime - offset); // clamp to end of current day
		duration -= durationDay;

		const dateKey = dateToString(current);
		if (bookingsData[dateKey] === undefined) {
			bookingsData[dateKey] = {};
		}
		if (bookingsData[dateKey][roomid] === undefined) {
			bookingsData[dateKey][roomid] = [];
		}
		bookingsData[dateKey][roomid].push(
			{"o": offset, "d": durationDay, "s": summary}
		);

		current.setHours(0, 0, 0, 0); // always begins at midnight for next days
		current.setDate(current.getDate() + 1);
	}
}

function showInfos() {
	document.getElementById("infos").showModal();
}

function closeInfos() {
	document.getElementById("infos").close();
}

/** update the "x minutes ago" and current time UI */
function timeTickRefresh() {
	const now = new Date();
	const diff = Math.abs(now - lastRefresh);
	const minsAgo = Math.floor((diff / 1000) / 60);

	let refreshText;
	if (minsAgo < 1) {
		refreshText = "just now";
	} else {
		refreshText = minsAgo + "m ago";
	}
	document.getElementById("lastRefresh").innerText = refreshText;

	const minutes = now.getHours() * 60 + now.getMinutes();
	timeDisplay.innerText = timeToString(minutes);
	timeDisplay.style.left = time2Pixels(minutes - startTime);
	timeMarkLine.style.left = time2Pixels(minutes - startTime);
}

/** create the main time table */
function createTable() {
	const tbl = document.createElement('table');
	tbl.id = "maintable";

	// group rooms into buildings
	for (let room in roomdata.rooms) {
		const r = roomdata.rooms[room];
		const bNo = r.building;

		if (roomdata.buildings[bNo] == undefined) {
			continue; // skip rooms that are not part of a valid building
		}
		if (buildings[bNo] == undefined) {
			buildings[bNo] = {};
		}
		buildings[bNo][room] = r;
	}

	// add header row with time stamps
	const tr = tbl.createTHead().insertRow();
	const th = document.createElement("th");
	tr.appendChild(th);

	for (let i = startTime; i <= endTime; i += timeStep) {
		tbl.createTHead();
		if (i % 60 == 0) {
			const th = document.createElement("th");
			th.appendChild(document.createTextNode(i / 60));
			tr.appendChild(th);
		} else {
			const small = document.createElement("small");
			small.appendChild(document.createTextNode(i % 60));
			const th = document.createElement("th");
			th.appendChild(small);
			tr.appendChild(th);
		}
	}

	// add rows for each room
	const tbody = tbl.createTBody();

	for (let b in buildings) {
		// add special building header row
		const tr = tbody.insertRow();
		const th = document.createElement("th");
		tr.appendChild(th);
		tr.classList.add("buildingTr");
		const str = document.createElement("strong");
		str.appendChild(document.createTextNode(roomdata.buildings[b]));
		th.appendChild(str);
		if (timeMarkLine === undefined) { // first building row has time marker line
			const timeCell = tr.insertCell();
			timeCell.style.visibility = "hidden";
			createTimeMarkLine(timeCell);
		}

		// add room rows for this building
		for (let r in buildings[b]) {
			const rm = buildings[b][r];

			const tr = tbody.insertRow();
			const th = document.createElement("th");
			tr.appendChild(th);

			const span = document.createElement("span");
			span.appendChild(document.createTextNode(rm.name));
			th.appendChild(span);

			th.appendChild(document.createElement("br"));

			const small = document.createElement("small");
			small.appendChild(document.createTextNode(rm.capacity));
			small.classList.add("capacity");
			th.appendChild(small);

			const td = tr.insertCell();
			td.colSpan = (endTime - startTime) / timeStep;
		}
	}
	document.getElementById("timetable").appendChild(tbl);
}

function createTimeMarkLine(parent) {
	timeMarkLine = document.createElement("div");
	timeMarkLine.id = "timeMarkLine";
	const height = roomdata.rooms.length * roomRowHeight + roomdata.buildings.length * buildingRowHeight;
	timeMarkLine.style.height = height + "px";
	parent.appendChild(timeMarkLine);

	timeDisplay = document.createElement("div");
	timeDisplay.id = "timeDisplay";
	parent.appendChild(timeDisplay);
}

// === from HTML events
function dateInputChanged() {
	const dateinput = document.getElementById("dateinput");
	selectDay(dateinput.value);
}

function selectPrevDay() {
	changeDay(-1);
}

function selectNextDay() {
	changeDay(+1);
}

function refresh() {
	refreshData();
}
// ===

function changeDay(offset) {
	const dateinput = document.getElementById("dateinput");
	const date = new Date(dateinput.value);
	date.setDate(date.getDate() + offset);
	dateinput.valueAsDate = date;
	selectDay(dateinput.value);
}

/** select the date for which the data should be shown (in "YYYY-MM-DD" format) */
function selectDay(date) {
	// only show current time when current day selected
	if (dateToString(new Date()) == date) {
		timeMarkLine.style.display = null; // CSS defined value
		timeDisplay.style.display = null;
	} else {
		timeMarkLine.style.display = "none";
		timeDisplay.style.display = "none";
	}

	const errorMsg = document.getElementById("inputerror");
	if (!date) {
		errorMsg.style.display = "block";
	} else {
		errorMsg.style.display = "none";
	}
	fillTable(date);
	if (usageCreated) {
		fillUsageStats(date);
	}
}

/** fill the time table with booking data for the specified date (in "YYYY-MM-DD" format) */
function fillTable(date) {
	const tbl = document.getElementById("maintable");
	let rowIdx = 1; // ignore header row

	for (let b in buildings) {
		// skip building row
		rowIdx++;
		// add room rows for this building
		for (let r in buildings[b]) {
			const cell = tbl.rows[rowIdx].cells[1]; // ignore first column
			rowIdx++;
			cell.replaceChildren(); // clear prev events

			// super secret easter egg code ;)
			if (date.startsWith("2805")) {
				const roomName = roomdata.rooms[r].name;
				if (roomName == "Eve") {
					addEventToRow({"o": 1080, "d": 120, "s": "Meet Wall-e today?"}, cell, r);
				} else if (roomName == "Wall-e") {
					addEventToRow({"o": 1080, "d": 120, "s": "Meet Eve today?"}, cell, r);
				}
			}
			// end easter egg code

			const day = roomdata.bookings[date];
			if (day == undefined || Object.keys(day).length === 0) { // days with no slots are empty objects
				continue;
			}
			for (let slot in day[r]) {
				const event = day[r][slot];
				addEventToRow(event, cell, r);
			}
		}
	}
}

/** remove all booking data from the time table */
function clearTable() {
	const tbl = document.getElementById("maintable");
	let rowIdx = 1; // ignore header row

	for (let b in buildings) {
		rowIdx++; // skip building row
		for (let r in buildings[b]) {
			const cell = tbl.rows[rowIdx].cells[1]; // ignore first column
			cell.replaceChildren(); // clear events
			rowIdx++;
		}
	}
}

/** adds a div representing the event to the parent table row */
function addEventToRow(event, parent, roomKey) {
	const titleStr = event.s && event.s.trim() ? event.s : "No Title";
	const timeStr = timeToString(event.o) + " - " + timeToString(event.o + event.d);

	const div = parent.appendChild(document.createElement("div"));
	div.classList.add("event");
	div.style.left = time2Pixels(event.o - startTime);
	div.style.width = time2Pixels(event.d);
	div.style.backgroundColor = roomdata.rooms[roomKey].color;
	div.title = titleStr + "\n" + timeStr;

	const title = div.appendChild(document.createElement("p"));
	const time = div.appendChild(document.createElement("div"));
	if (event.s && event.s.trim()) {
		title.innerText = event.s; // use innerText to avoid injection
	} else {
		title.innerHTML = "<i>No Title</i>"; // use innerHTML for styled string
	}
	time.innerText = timeStr;
}

/** converts a given time in minutes to a pixel offset for the table */
function time2Pixels(time) {
	return (time / timeStep * timeStepSize) + "px";
}

/** fill the usage statistics for the specified date (in "YYYY-MM-DD" format) */
function fillUsageStats(date) {
	const rs = Array(roomdata.rooms.length);
	const slots = Array((endTime - startTime) / timeStep).fill(0);

	for (let room in roomdata.rooms) {
		rs[room] = { name:roomdata.rooms[room].name, time:0 };

		const day = roomdata.bookings[date];
		if (day == undefined || Object.keys(day).length === 0) { // days with no slots are empty objects
			continue;
		}

		for (let booking in day[room]) {
			const event = day[room][booking];
			rs[room].time += event.d;

			let eventStart = event.o;
			do {
				let slot = (eventStart - startTime) / timeStep;
				eventStart += timeStep;
				slots[slot]++;
			} while (eventStart < event.o + event.d);
		}
		rs[room].time /= 60;
	}

	let mDate = new Date(date);
	let firstDay = new Date(mDate.getFullYear(), mDate.getMonth(), 1);
	let currentDate = new Date(firstDay);
	const month = Array();

	while (currentDate.getMonth() === mDate.getMonth()) {
		const label = `${currentDate.getDate()}. (${dayNames[currentDate.getDay()]})`;
		const hours = totalTimeHours(dateToString(currentDate));
		month.push({ name:label, time:hours });

		currentDate.setDate(currentDate.getDate() + 1);
	}

	// title tag
	const totalHours = Math.round(month[mDate.getDate() - 1].time);
	document.getElementById("usageStatsTitle").innerHTML = `A total of ~${totalHours} hours of meetings this day.`;

	if (totalHours <= 2) {
		document.getElementById("usageStatsHint").innerHTML = "*crickets*";
	} else if (totalHours <= 10) {
		document.getElementById("usageStatsHint").innerHTML = "Not too much going on this day.";
	} else {
		document.getElementById("usageStatsHint").innerHTML = "Seems like another busy day at the OIC.";
	}

	// update charts
	const btsChart = usageCharts.busyTimeSlots;
	btsChart.data.datasets[0].data = slots;
	btsChart.update();

	const omChart = usageCharts.overviewMonth;
	omChart.data.labels = month.map(item => item.name);
	omChart.data.datasets[0].data = month.map(item => item.time);
	omChart.update();

	rs.sort((a, b) => b.time - a.time);
	const brChart = usageCharts.busyRooms;
	brChart.data.labels = rs.map(item => item.name);
	brChart.data.datasets[0].data = rs.map(item => item.time);
	brChart.update();
}

/** create all charts for the usage stats page */
function createUsageStats() {
	usageCreated = true;
	const slotNames = Array((endTime - startTime) / timeStep);

	for (let i = 0; i < slotNames.length; i++) {
		slotNames[i] = timeToString(i * timeStep + startTime);
	}

	// busiest time slots
	usageCharts.busyTimeSlots = new Chart(document.getElementById("busyTimeSlots"), {
		type: "line",
		data: {
			labels: slotNames,
			datasets: [{
				label: "# of meetings",
				data: [],
				backgroundColor: "#0d6efd"
			}]
		}
	});

	// overview month
	usageCharts.overviewMonth = new Chart(document.getElementById("overviewMonth"), {
		type: "line",
		data: {
			labels: Array(30).fill(""),
			datasets: [{
				label: "total hours of meetings",
				data: [],
				backgroundColor: "#0d6efd"
			}]
		}
	});

	// busiest rooms
	usageCharts.busyRooms = new Chart(document.getElementById("busyRooms"), {
		type: "bar",
		data: {
			labels: Array(roomdata.rooms.length).fill(""),
			datasets: [{
				label: "hours of meetings",
				data: [],
				backgroundColor: "#0d6efd"
			}]
		}
	});
}

/** gets the total hours of meetings for a specified date */
function totalTimeHours(date) {
	const day = roomdata.bookings[date];
	if (day == undefined || Object.keys(day).length === 0) { // days with no slots are empty objects
		return 0;
	}

	let minutes = 0;
	for (let room in roomdata.rooms) {
		for (let booking in day[room]) {
			minutes += day[room][booking].d;
		}
	}
	return minutes / 60;
}

/** takes a time in minutes from midnight and returns a string in format hh:mm */
function timeToString(time) {
	const min = (time % 60).toString().padStart(2, "0");
	return Math.floor(time / 60) + ":" + min;
}

/** takes a Date object and returns a string in the format "YYYY-MM-DD" */
function dateToString(date) {
	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth()+1).toString().padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** display one of the tabs and hide the others */
function openTab(evt) {
	const tabName = evt.currentTarget.tabName;

	// hide all tabs
	const tabcontent = document.getElementsByClassName("tabcontent");
	for (let i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = "none";
	}

	// remove active from tablinks
	const tablinks = document.getElementsByClassName("tablinks");
	for (let i = 0; i < tabcontent.length; i++) {
		tablinks[i].classList.remove("tablinkactive");
	}

	// Show the current tab, and highlight tablink
	document.getElementById(tabName).style.display = "block";
	evt.currentTarget.classList.add("tablinkactive");

	if (!usageCreated && tabName == "usageStats") {
		createUsageStats();
		fillUsageStats(document.getElementById("dateinput").value);
	}
}
})();


// ==UserScript==
// @name         OIC Timetable
// @namespace    http://tampermonkey.net/
// @require      https://unpkg.com/ical.js@2.1.0/dist/ical.es5.min.cjs
// @require      https://cdn.jsdelivr.net/npm/chart.js
// @version      2025-05-27
// @description  Make it easy to check which rooms are booked at the JKU OIC.
// @author       Felix Schmid
// @match        https://gwcal.jku.at/timetable
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
const startTime = 360; // 6:00
const endTime = 1320; // 22:00
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
<html lang="de">
<head>
	<title>OIC Timetable</title>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">

	<meta name="author" content="Felix Schmid"/>
	<meta name="keywords" content=""/>
	<meta name="description" content=""/>
</head>
<body>
<main>
<style>
/* main menu styling */
body {
	font-family: sans-serif;
}

main, .chartRegion {
	width: 900px;
	max-width: 100%;
	margin: 0 auto;
}

.chartRegion {
	margin-bottom: 100px;
}

#disclaimer {
	background-color: #e9e9e9;
	border-left: 4px solid #c6c6c6;
	padding: 8px;
}

.errorcontainer {
	background-color: #ffd3d3;
	border-left: 4px solid #ec5656;
	padding: 8px;
	display: none;
}

.errorcontainer p {
	margin: 4px 0;
}

#datepanel {
	display: flex;
	gap: 5px;
	align-items: center;
	margin: 0.83em 0 0.83em 0;
}

#datepanel > span {
	font-size: 1.5em;
	font-weight: bold;
}

#datepanel > div {
	color: #8f8f8f;
}

#datepanel :first-child {
	margin-right: 5px;
}

.chart {
	max-width: 700px;
}

/* tab control styling */
.tab {
	display: flex;
	justify-content: center;
	margin: 20px 0;
}

.tab img {
	vertical-align: middle;
	margin-right: 5px;
}

.tab button {
	border: none;
	border-radius: 5px;
	background-color: #e9e9e9;
	cursor: pointer;
	margin: 0 10px;
	padding: 10px 12px;
}

.tab button:hover {
	background-color: #afc6e8;
}

.tab button.tablinkactive {
	background-color: #0d6efd;
	color: white;
}

.tab button.tablinkactive img {
	filter: invert(100%);
}

.tabcontent {
	display: none;
}

/* table styling */
table {
	border-collapse: collapse;
	margin: 0 auto;
	overflow: clip;
}

table th:first-child {
	top: -50px;
	left: 0;
	text-align: right;
	padding: 0 10px;
	font-weight: normal;
}

tbody > tr:hover { /* for row hover selection */
	background-color: #9ec5fe;
}

thead > tr > th {
	translate: -14px;
}

tr {
	height: 54px;
}

.buildingTr {
	height: 30px !important;
}

td {
	position: relative;
	background-size: 112px;
	background-image: linear-gradient(to right, rgb(255, 255, 255) 1px, rgba(200, 200, 200, 0.4) 1px);
	padding: 0;
}

th {
	position: sticky;
	top: 0;
	min-width: 26px;
	background-color: white;
	white-space: nowrap;
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
	background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAA1ElEQVRIx+2UzRGCMBCFv1gBdkALVCAlYAWWsFoBQwXOVqB2YAmUQAdaAh3gZQ8Zh58MwZED70YW3hd28wKb/i0X8pKqJkAJ5EAC1EAlIu9ogJm/zNhXC2RTkF3AD1x7zLG1curjEEA+UiuWAEQpBFDPrAUDLv5D13X+kKtogIi0wB64AzjnWtt5JiLNuoOmqilw8gKWWqmxFjXAYywLbsA4t/OfDmSgb9gqIs9JgKqeLUDJjI4cvyF9Qz7MNAe4hZyiImKmyaJJ9jLxm6vCOcem9esD2v8ydCSYqJYAAAAASUVORK5CYII=);
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
	<h1>OIC Timetable</h1>
	<div id="disclaimer">
		<strong>Disclaimer:</strong> This is an unofficial service, provided without guarantees.
		Results are based on data from <a href="https://gwcal.jku.at/">gwcal.jku.at</a>
	</div>

	<div id="datepanel">
		<span>Showing data for</span>
		<button id="prevDayBtn"> &lt; </button>
		<input type="date" id="dateinput" name="date input"/>
		<button id="nextDayBtn"> &gt; </button>
		<div style="flex-grow: 1"></div>
		<button id="refreshBtn"> refresh </button>
		<div id="lastRefresh"></div>
	</div>

	<div id="inputerror" class="errorcontainer"><p>
		Please select a valid date.
	</p></div>

	<div id="fetcherror" class="errorcontainer"><p>
		There was an error while fetching booking data.<br>
		This may be because you are not logged in. Make sure you are logged in
		<a target="_blank" rel="noopener noreferrer" href="https://gwcal.jku.at/gwcal/calendar/b2ljX3VyYW51c0Bqa3UuYXQ_Y249Q2FsZW5kYXI?Calendar.format=html">here</a>
		and then refresh.<br>
		More details in the console.
	</p></div>

	<div class="tab">
		<button id="openTable" class="tablinks">
			<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAABH0lEQVRIS71VixXCIAykuIhuoBt0NSdRJ7EjdANdxOKlfEqBGGmtvEerEO7C5dNGbTyajfHVJwLjyCUnjIbhoMpY6wm0MoSOUcRKF48wvGDSuzjIWxojpnM9Muzw+4xJ7yLrHYdajdPWKX6QZ17DkYkOWeYnngeO4FvdudsZRxOUSSVaRWAvNd5NJBAEErcXEuRBTZhCZEQCKfe5K2QSbxCDeXZKBCETBXU8TuUNtEaVJhUxL4A03SsJxGTJDLK+NJcIfcVV8d+CPHWDWAy7WnKiWiKzA9KrLNVPCOqiUGjdUprWEUwNlq3kBxD3HjXO/Tw70xX7H88egThx7brFBn1wAgkZpkWmgTJE4Y/2O5jfMK8cQa0kov3SfBeBvcEb5fNMGd3UNFEAAAAASUVORK5CYII=" alt="timetable icon" /> Timetable
		</button>
		<button id="openUsage" class="tablinks">
			<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAABa0lEQVRIS71V21HDMBA8KT/M8JMSnA5MB6GD0AEpIRUwqSAlGCqgBFKCO8Al8JMZPsBi7yQrjiyNkYPRjMbR43b39i62opmHmhmf/p2gREYVJj+zhsZtqD1i7r/w7ILDDN6wsTZ9aI5sE1wat1vc9ncEriEyqxSBcZenWtdp8/Eh0OBClk+QzoAAmYtAAVs0Xk1wUSaXpRMvBbmSQEPmsPCOQOgyCQpaojeeELizasslUV0BZmMd8aCTigww+W9sMGvMe1lrrFtZl2TbVZFCDaTMCYvgnnGZdyn2wSVvSPzAg/cZ/AHzPTMDXyQLflbK9rwG4I03yP7IsohteYTsGmGstLkhKj5pgf3vLa8D8DyCW3h7InWAqBRYBD8vgxjA2F6WRWNgw3NFRqOLWttKMv78XRTihgRoOVVcNkPsrWCV9U96a27fu1QGaxxUaNSCg+PQZ2cin4ojTl8wn1ME+b6PREz9sPxayOwEP3vsZRkXsbilAAAAAElFTkSuQmCC" alt="usage statistics icon" /> Usage Statistics
		</button>
	</div>
</main>

<div id="timetable" class="tabcontent"></div>

<div id="usageStats" class="tabcontent chartRegion"> <!-- per day -->
	<h1 id="usageStatsTitle"> </h1>
	<p id="usageStatsHint"> </p>

	<h2> Most people are here at... </h2>
	<p> Time slots with the most meetings at the same time. </p>
	<div class="chart">
		<canvas id="busyTimeSlots"></canvas>
	</div>

	<h2> A monthly overview. </h2>
	<p> The total meeting time for each day of the selected month. </p>
	<div class="chart">
		<canvas id="overviewMonth"></canvas>
	</div>

	<h2> Are all rooms booked out? </h2>
	<p> The rooms with the highest usage rate. </p>
	<div class="chart">
		<canvas id="busyRooms"></canvas>
	</div>
</div>
</body>
</html>`;

// TODO: time marker and events before startTime (6:00) & after endTime (22:00) are cut off
// TODO: events spanning multiple days are ignored

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

	createTable();
	document.getElementById("dateinput").valueAsDate = new Date(); // now
	document.getElementById("openTable").click();

	setInterval(timeTickRefresh, 10000); // refresh shown time every 10s
	refreshData();
}

/** fetch data from OIC, create table and select today as date */
function refreshData() {
	const fetcherror = document.getElementById("fetcherror");
	fetcherror.style.display = "none";

	lastRefresh = new Date();
	timeTickRefresh(); // immediatly update refresh text
	roomdata.bookings = {}; // clear any previous data
	clearTable(); // remove events from table to indicate when refresh is finished
	let nFetched = 0;
	const toFetch = Object.entries(roomdata.rooms).length;

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
	const start = event.getFirstPropertyValue("dtstart").toJSDate();
	const end = event.getFirstPropertyValue("dtend").toJSDate();
	const desc = event.getFirstPropertyValue("summary");

	if (start.getFullYear() != end.getFullYear() ||
		start.getMonth() != end.getMonth() ||
		start.getDate() != end.getDate()) {
		console.info("Events spanning days not supported.");
		console.info(desc + ": " + start + " - " + end);
	} else {
		const sMin = start.getHours() * 60 + start.getMinutes();
		const eMin = end.getHours() * 60 + end.getMinutes();
		const dateKey = dateToString(start);

		if (bookingsData[dateKey] === undefined) {
			bookingsData[dateKey] = {};
		}
		if (bookingsData[dateKey][roomid] === undefined) {
			bookingsData[dateKey][roomid] = [];
		}
		bookingsData[dateKey][roomid].push(
			{"s": sMin, "e": eMin, "d": desc}
		);
	}
}

/** update the "x minutes ago" and current time UI */
function timeTickRefresh() {
	const now = new Date();
	const diff = Math.abs(now - lastRefresh);
	const minsAgo = Math.floor((diff / 1000) / 60);

	let refreshText;
	if (minsAgo < 1) {
		refreshText = "just now";
	} else if (minsAgo == 1) {
		refreshText = minsAgo + " minute ago";
	} else {
		refreshText = minsAgo + " minutes ago";
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
		if (b == 0) { // first building row has time marker line
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
	dateInputChanged();
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
					addEventToRow({"s": 1080, "e": 1200, "d": "Meet Wall-e today?"}, cell, r);
				} else if (roomName == "Wall-e") {
					addEventToRow({"s": 1080, "e": 1200, "d": "Meet Eve today?"}, cell, r);
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
	const titleStr = event.d ? event.d : "No Title";
	const timeStr = timeToString(event.s) + " - " + timeToString(event.e);

	const div = parent.appendChild(document.createElement("div"));
	div.classList.add("event");
	div.style.left = time2Pixels(event.s - startTime);
	div.style.width = time2Pixels(event.e - event.s);
	div.style.backgroundColor = roomdata.rooms[roomKey].color;
	div.title = titleStr + "\n" + timeStr;

	const title = div.appendChild(document.createElement("p"));
	const time = div.appendChild(document.createElement("div"));
	if (event.d) {
		title.innerText = event.d; // use innerText to avoid injection
	} else {
		title.innerHTML = "<i>No Title</i>"; // use innerHTML for styled string
	}
	time.innerText = timeStr;
}

/** converts a given time in minutes to a pixel offset for the table */
function time2Pixels(time) {
	return (time / timeStep * timeStepSize) + "px";
}

/** check if a given room is booked at a given time and date */
function isBooked(room, time, date) {
	const day = roomdata.bookings[date];

	if (day == undefined || Object.keys(day).length === 0) { // days with no slots are empty objects
		return false;
	}
	for (let slot in day[room]) {
		if (time >= day[room][slot].s && time < day[room][slot].e) {
			return true;
		}
	}
	return false;
}

/** fill the usage statistics for the specified date (in "YYYY-MM-DD" format) */
function fillUsageStats(date) {
	const rs = Array(Object.keys(roomdata.rooms).length);
	const bs = Array(Object.keys(roomdata.buildings).length);
	const slots = Array((endTime - startTime) / timeStep).fill(0);
	let totalTime = 0;

	for (let b in buildings) {
		if (bs[b] == undefined) {
			bs[b] = { name:roomdata.buildings[b].name, time:0 };
		}
		for (let r in buildings[b]) {
			const room = buildings[b][r];
			rs[r] = { name:room.name, time:0 };

			const day = roomdata.bookings[date];

			if (day == undefined || Object.keys(day).length === 0) { // days with no slots are empty objects
				continue;
			}
			for (let slot in day[r]) {
				const event = day[r][slot];
				const time = event.e - event.s;
				rs[r].time += time;
				bs[b].time += time;
				totalTime += time;
			}
			for (let i = 0; i < slots.length; i++) {
				const time = i * timeStep + startTime;
				if (isBooked(r, time, date)) {
					slots[i]++;
				}
			}
		}
	}

	const totalHours = Math.round(totalTime / 60);

	let mDate = new Date(date);
	let firstDay = new Date(mDate.getFullYear(), mDate.getMonth(), 1);
	let currentDate = new Date(firstDay);
	const month = Array();

	while (currentDate.getMonth() === mDate.getMonth()) {
		const label = `${currentDate.getDate()}. (${dayNames[currentDate.getDay()]})`;
		const minutes = totalTimeMinutes(dateToString(currentDate));
		month.push({ name:label, time:minutes });

		currentDate.setDate(currentDate.getDate() + 1);
	}

	// total hours
	document.getElementById("usageStatsTitle").innerHTML = `A total of ~${totalHours} hours of meetings this day!`;

	if (totalHours <= 2) {
		document.getElementById("usageStatsHint").innerHTML = "*crickets*";
	} else if (totalHours <= 10) {
		document.getElementById("usageStatsHint").innerHTML = "Not too much going on this day.";
	} else {
		document.getElementById("usageStatsHint").innerHTML = "Seems like another busy day at the OIC.";
	}

	// busiest time slots
	const btsChart = usageCharts.busyTimeSlots;
	btsChart.data.datasets[0].data = slots;
	btsChart.update();

	rs.sort((a, b) => b.time - a.time);
	const brChart = usageCharts.busyRooms;
	brChart.data.labels = rs.slice(0, 15).map(item => item.name);
	brChart.data.datasets[0].data = rs.slice(0, 15).map(item => item.time / (slots.length * timeStep) * 100);
	brChart.data.datasets[1].data = rs.slice(0, 15).map(item => 100 - (item.time / (slots.length * timeStep)) * 100);
	brChart.update();

	const omChart = usageCharts.overviewMonth;
	omChart.data.labels = month.map(item => item.name);
	omChart.data.datasets[0].data = month.map(item => item.time / 60);
	omChart.update();
}

/** create all charts for the usage stats page */
function createUsageStats() {
	usageCreated = true;
	const slotNames = Array((endTime - startTime) / timeStep);

	for (let i = 0; i < slotNames.length; i++) {
		const time = i * timeStep + startTime;
		const min = (time % 60).toString().padStart(2, "0");
		slotNames[i] = `${Math.floor(time / 60)}:${min}`;
	}

	const stackedOption = {
		scales: {
			x: { stacked: true },
			y: { stacked: true }
		}
	};

	// busiest time slots
	usageCharts.busyTimeSlots = new Chart(document.getElementById("busyTimeSlots"), {
		type: "line",
		data: {
			labels: slotNames,
			datasets: [{
				label: "# of meetings",
				data: [],
				backgroundColor: "#5b9bd5"
			}]
		}
	});

	// overview month
	usageCharts.overviewMonth = new Chart(document.getElementById("overviewMonth"), {
		type: "line",
		data: {
			labels: Array(30).fill(""),
			datasets: [{
				label: "total meeting time",
				data: [],
				backgroundColor: "#5b9bd5"
			}]
		}
	});

	// busiest rooms
	usageCharts.busyRooms = new Chart(document.getElementById("busyRooms"), {
		type: "bar",
		data: {
			labels: Array(15).fill(""),
			datasets: [{
				label: "% occupied",
				data: [],
				backgroundColor: "#ed7d31"
			}, {
				label: "% free",
				data: [],
				backgroundColor: "#70ad47"
			}]
		},
		options: stackedOption
	});
}

/** gets the total hours of meetings for a specified date */
function totalTimeMinutes(date) {
	const day = roomdata.bookings[date];

	if (day == undefined || Object.keys(day).length === 0) { // days with no slots are empty objects
		return 0;
	}

	let hours = 0;
	for (let room in roomdata.rooms) {
		for (let slot in day[room]) {
			hours += day[room][slot].e - day[room][slot].s;
		}
	}
	return hours;
}

/** takes a time in minutes from midnight and returns a string in format hh:mm */
function timeToString(time) {
	const hour = Math.floor(time / 60).toString().padStart(2, "0");
	const min = (time % 60).toString().padStart(2, "0");
	return hour + ":" + min;
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

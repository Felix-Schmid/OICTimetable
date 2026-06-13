const roomdata = {
	"rooms": [
		{"name": "Merkur", "building": 0, "capacity": 4, "color": "#8c8a89", "id": "merkur"},
		{"name": "Venus", "building": 0, "capacity": 4, "color": "#dab292", "id": "venus"},
		{"name": "Erde", "building": 0, "capacity": 4, "color": "#6288a8", "id": "erde"},
		{"name": "Mars", "building": 0, "capacity": 4, "color": "#f27c5f", "id": "mars"},
		{"name": "Jupiter", "building": 0, "capacity": 10, "color": "#c08137", "id": "jupiter"},
		{"name": "Saturn", "building": 0, "capacity": 10, "color": "#dab778", "id": "saturn"},
		{"name": "Uranus", "building": 0, "capacity": 10, "color": "#95bbbe", "id": "uranus"},
		{"name": "Neptun", "building": 0, "capacity": 10, "color": "#7595bf", "id": "neptun"},
		{"name": "Bumblebee", "building": 1, "capacity": 10, "color": "#debd45", "id": "bumblebee"},
		{"name": "Eve", "building": 1, "capacity": 10, "color": "#4e79e8", "id": "eve"},
		{"name": "Optimus-Prime", "building": 1, "capacity": 4, "color": "#d04a4a", "id": "optimus-prime"},
		{"name": "Seminar-room", "building": 1, "capacity": 20, "color": "#54a348", "id": "seminar-room"},
		{"name": "Wall-e", "building": 1, "capacity": 10, "color": "#d9884a", "id": "wall-e"}
	],
	"buildings": [
		"Erdgeschoss",
		"1. Obergeschoss"
	],
	"bookings": {
	}
};
const baseUrl = "room/";
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

// TODO
// * fix table header row not sticky: table has overflow:auto, which does not work with sticky...
// * show small spinner during refresh: https://cssloaders.github.io/
// * maybe rework fetch for when only some rooms can be loaded
// * shareable deep links (date + tab)

function init() {
	console.log("init called!");

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
		fetch(baseUrl + roomdata.rooms[key].id)
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

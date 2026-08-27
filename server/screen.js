let bookings = {};
let refreshTimerID = 0;

// ==== html elements
let roomName;
let currentName;
let currentTime;
let eInkDisplay;
let upcomingList;

window.onload = function() {
	init();
};

function init() {
	roomName = document.getElementById("room-name");
	currentName = document.getElementById("current-name");
	currentTime = document.getElementById("current-time");
	eInkDisplay = document.getElementById("e-ink-display");
	upcomingList = 	document.getElementById("upcoming-list");
	onhashchange = () => { refreshData() };
	refreshData();
}

/** fetch data from OIC, and refresh the screen */
function refreshData() {
	bookings = {}; // clear any previous data
	
	let hash = window.location.hash;
	if (hash) {
		hash = hash.substring(1); // remove "#"
	}
	if (!hash || !(hash in rooms)) { // hash was empty or invalid
		clearScreen();
		roomName.innerText = "[ERROR] Invalid room ID";
		return;
	}
	roomName.innerText = rooms[hash].name;

	fetch(baseUrl + hash)
		.then(response => {
			if (response.ok) {
				return response.text();
			}
			throw new Error("Could not fetch data");
		})
		.then(data => {
			bookings = getBookingsFromICAL(data);
			refreshScreen();
		})
		.catch((error) => {
			clearScreen();
			roomName.innerText = "[ERROR] Could not fetch data";
			console.warn(error);
		});
}

/** refresh the info screen with booking data for the current time and date */
function refreshScreen() {
	const now = new Date();
	const minutes = now.getHours() * 60 + now.getMinutes();

	let bookingsDay = bookings[dateToString(now)];
	if (bookingsDay == undefined || Object.keys(bookingsDay).length === 0) { // days with no slots are empty objects
		bookingsDay = [];
	}

	let upcomingEvents = bookingsDay
		.slice() // create a shallow copy
		.sort((a, b) => a.o - b.o) // sort by event offset
		.filter(event => (event.o + event.d) >= minutes) // remove past events
		.slice(0, 3); // take first 3

	let currentEvent = null;
	let upcoming = [...upcomingEvents]; // create a copy to work with

	if (upcoming.length > 0 && upcoming[0].o < minutes) {
		currentEvent = upcoming.shift(); // remove current from upcoming
	}

	// set title of current
	if (currentEvent == null) {
		currentName.innerText = "FREE";
		eInkDisplay.classList = ["is-free"];

		if (upcoming.length == 0) {
			currentTime.innerText = "For Today";
			scheduleRefresh(60 * 24); // refresh at midnight
		} else {
			currentTime.innerText = "Until " + minutesToClock(upcoming[0].o);
			scheduleRefresh(upcoming[0].o);
		}
	} else {
		eInkDisplay.classList = ["is-busy"];
		setEventTitle(currentEvent, currentName);
		setEventTime(currentEvent, currentTime);
		scheduleRefresh(currentEvent.o + currentEvent.d);
	}

	// set upcoming section
	upcomingList.replaceChildren(); // clear
	for (let i = 0; i < Math.min(upcoming.length, 2); i++) {
		const event = upcoming[i];

		const li = document.createElement("li");
		const nameSpan = document.createElement("span");
		nameSpan.className = "meeting-name";
		const timeSpan = document.createElement("span");
		timeSpan.className = "meeting-time";

		setEventTitle(event, nameSpan);
		setEventTime(event, timeSpan);

		li.appendChild(timeSpan);
		li.appendChild(nameSpan);
		upcomingList.appendChild(li);
	}
	if (upcoming.length == 0) {
		upcomingList.innerHTML = "<li><i><small>No further meetings are currently scheduled for today.</small></i></li>";
	}
}

/** schedule the next screen refresh in minutes from midnight */
function scheduleRefresh(minutes) {
	clearTimeout(refreshTimerID) // clear a potential previous refresh timer (e.g., on data refresh)
	const refresh = new Date();
	refresh.setHours(0, minutes, 1); // add one second to make sure refresh happens after new event
	const eta = refresh - Date.now();
	refreshTimerID = setTimeout(refreshScreen, eta);
}

/** remove all booking data from the info screen */
function clearScreen() {
	currentName.innerText = "";
	currentTime.innerText = "";
	eInkDisplay.classList = ["is-free"];
	upcomingList.innerHTML = "-";
}

function setEventTitle(event, nameElem) {
	if (event.s && event.s.trim()) {
		nameElem.innerText = event.s; // use innerText to avoid injection
	} else {
		nameElem.innerHTML = "<i>No Title</i>"; // use innerHTML for styled string
	}
}

function setEventTime(event, timeElem) {
	timeElem.innerText = minutesToClock(event.o) + " - " + minutesToClock(event.o + event.d);
}

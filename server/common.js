const rooms = {
	"merkur": {"name": "Merkur", "building": "Erdgeschoss", "capacity": 4, "color": "#8c8a89"},
	"venus": {"name": "Venus", "building": "Erdgeschoss", "capacity": 4, "color": "#dab292"},
	"erde": {"name": "Erde", "building": "Erdgeschoss", "capacity": 4, "color": "#6288a8"},
	"mars": {"name": "Mars", "building": "Erdgeschoss", "capacity": 4, "color": "#f27c5f"},
	"jupiter": {"name": "Jupiter", "building": "Erdgeschoss", "capacity": 10, "color": "#c08137"},
	"saturn": {"name": "Saturn", "building": "Erdgeschoss", "capacity": 10, "color": "#dab778"},
	"uranus": {"name": "Uranus", "building": "Erdgeschoss", "capacity": 10, "color": "#95bbbe"},
	"neptun": {"name": "Neptun", "building": "Erdgeschoss", "capacity": 10, "color": "#7595bf"},
	"bumblebee": {"name": "Bumblebee", "building": "1. Obergeschoss", "capacity": 10, "color": "#debd45"},
	"eve": {"name": "EVE", "building": "1. Obergeschoss", "capacity": 10, "color": "#4e79e8"},
	"optimus-prime": {"name": "Optimus-Prime", "building": "1. Obergeschoss", "capacity": 4, "color": "#d04a4a"},
	"seminar-room": {"name": "Seminar-room", "building": "1. Obergeschoss", "capacity": 20, "color": "#54a348"},
	"wall-e": {"name": "WALL·E", "building": "1. Obergeschoss", "capacity": 10, "color": "#d9884a"}
};
const baseUrl = "room/";

function getBookingsFromICAL(icalData) {
	const bookings = {};
	const parseRes = ICAL.parse(icalData);
	const comp = new ICAL.Component(parseRes);
	const vevents = comp.getAllSubcomponents("vevent");

	vevents.forEach(event => {
		addBookingEvent(event, bookings);
	});
	return bookings;
}

function addBookingEvent(event, bookingsData) {
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
		addBookingTime(next, event, bookingsData);
	}
	if (!expanded) {
		addBookingTime(start, event, bookingsData);
	}
}

function addBookingTime(time, event, bookingsData) {
	const current = time.toJSDate();
	const summary = event.getFirstPropertyValue("summary");

	const start = event.getFirstPropertyValue("dtstart").toJSDate();
	const end = event.getFirstPropertyValue("dtend").toJSDate();
	let duration = (end - start) / (1000 * 60); // ms to minutes

	let currentEnd = new Date(current);
	currentEnd = currentEnd.setMinutes(currentEnd.getMinutes() + duration);

	while (current < currentEnd) {
		const offset = current.getHours() * 60 + current.getMinutes();
		const durationDay = Math.min(duration, 24 * 60 - offset); // clamp to end of current day
		duration -= durationDay;

		const dateKey = dateToString(current);
		if (bookingsData[dateKey] === undefined) {
			bookingsData[dateKey] = [];
		}
		bookingsData[dateKey].push(
			{"o": offset, "d": durationDay, "s": summary}
		);
		
		current.setHours(0, 0, 0, 0); // always begins at midnight for next days
		current.setDate(current.getDate() + 1);
	}
}

/** takes a time in minutes from midnight and returns a string in format hh:mm */
function minutesToClock(time) {
	const min = (time % 60).toString().padStart(2, "0");
	return Math.floor(time / 60) + ":" + min;
}

/** takes a Date object and returns a string in the format "YYYY-MM-DD" */
function dateToString(date) {
	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth()+1).toString().padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

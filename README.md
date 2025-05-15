# OIC Timetable

This is a web application that makes it easy to check which rooms are booked at the JKU OIC.

The official way to check this through the OIC help website has the drawback that it displays a weekly
overview for one room at a time, making it inconvenient to find a free room for a desired time slot.
Therefore, this web application instead shows a table with all rooms for one day, providing a better
overview and making it easy to find a free room.

Additionally, some usage charts are included, showing which time slots of a day and which days of a
month already have a lot of meetings booked.

This app is based on one of my previous projects (https://felix-schmid.github.io/JKUTimetable/).

## Usage

Making this app run on your machine sadly involves more than 1 step:

1. go to the calendar of any room to make sure you are logged in (e.g. https://gwcal.jku.at/gwcal/calendar/b2ljX3VyYW51c0Bqa3UuYXQ_Y249Q2FsZW5kYXI?Calendar.format=html)
2. go to the base URL (https://gwcal.jku.at/)
3. open the browser developer console, paste in "OICtimetable.js" in its entirety and hit enter

**WARNING**: Pasting stuff into the developer console is dangerous. If you don't blindly trust me
(which you shouldn't) then your only option is to use the force and read the source...

This process to get started is not quite as convenient as it should be for reasons discussed in the
next section. However, once the app is running, it should keep working as long as you don't close
or reload the tab. For updating the displayed data, please use the refresh button on the page.
The refresh might stop working after a while when your login session expires. In this case, you
can get a new session on a different tab (by repeating step 1), which should make the app work again.

## Why it was done this way

The calendar data needed to make this app work is behind a login, and modern browser security features
prevent us from getting it via JavaScript if we are not on the same domain (see [CORS](https://developer.mozilla.org/de/docs/Web/HTTP/Guides/CORS)).
This is why we need to paste a user script instead of just running a local website.

Due to another security feature, our user script cannot load additional JavaScript code outside of the
website (see [CPS](https://developer.mozilla.org/de/docs/Web/HTTP/Guides/CSP)).
Therefore, I had to statically include the minified libraries needed by the app (ics.js & charts.js)
inside the file. To make it a single copy & paste action, I also included HTML, CSS and images (as
base64 strings) for the app. Unfortunately, this made the file quite big and a bit annoying to work with.

If you know a better way to do this, please let me know.

## Alternative implementation options considered

As an alternative to a single user script that needs to be pasted into the developer console, I could
have also made a small server (e.g. with Python) to locally host the site. The server could then handle
fetching the data from gwcal.jku.at. This would require users to install Python with the necessary
packages, start the server in a terminal, and enter their credentials. All in all, this is not much
easier than the current solution.

A second alternative is to write a standalone desktop app, which may require a lot of additional work.
The best bet would probably be something like Electron, allowing reuse of the existing UI and keeping
the platform independence. However, I am not very familiar with this framework myself.

Additionally, both above-mentioned alternatives would have required to reverse engineer and implement
the login and session handling for gwcal.jku.at, which the current solution does not need to do.

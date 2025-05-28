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

Making this app run on your machine requires the following steps:

1. install the [Tampermonkey](https://www.tampermonkey.net/) plugin for your browser
2. open the Tampermonkey menu and select "Dashboard"
3. go to "Utilities" and choose "Import from URL"
4. paste in this URL https://raw.githubusercontent.com/Felix-Schmid/OICTimetable/refs/heads/main/OICtimetable.js and hit install
5. visit [https://gwcal.jku.at/timetable](https://gwcal.jku.at/timetable)

**WARNING**: Installing a custom user script can be dangerous. If you don't blindly trust me
(which you shouldn't) then your only option is to use the force and read the source...

You can then bookmark the page mentioned in the last step to quickly visit the app from now on. If you
restart the browser or your login session expires in other ways, the app will at first fail to fetch
the data and therefore link you to a calendar of one of the rooms to login again. Once logged in, you
can refresh the app and it should work again.

## Why it was done this way

The calendar data needed to make this app work is behind a login, and modern browser security features
prevent us from getting it via JavaScript if we are not on the same domain
(see [CORS](https://developer.mozilla.org/de/docs/Web/HTTP/Guides/CORS)). This is why we need a user
script instead of just running a local website.

I currently statically include HTML, CSS and images (as base64 strings) in the user script, so we do not
have to host them somewhere just to fetch them again or include them as resources. However, doing it this
way made the file quite big and a bit annoying to work with, so I might change that in the future.

## Alternative implementation options considered

As an alternative to a single user script, I could have also made a small server (e.g. with Python) to
locally host the site. The server could then handle fetching the data from gwcal.jku.at. This would require
users to install Python with the necessary packages, start the server in a terminal, and enter their
credentials. All in all, this is not easier than the current solution.

A second alternative is to write a standalone desktop app, which may require a lot of additional work.
The best bet would probably be something like Electron, allowing reuse of the existing UI and keeping
the platform independence. However, I am not very familiar with this framework myself.

Additionally, both above-mentioned alternatives would have required to reverse engineer and implement
the login and session handling for gwcal.jku.at, which the current solution does not need to do.

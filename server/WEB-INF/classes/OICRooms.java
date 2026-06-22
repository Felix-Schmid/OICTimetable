import java.io.*;
import java.net.*;
import java.text.MessageFormat;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.servlet.*;
import jakarta.servlet.http.*;

public class OICRooms extends HttpServlet {

	private static class RoomData {

		static final HttpClient client = HttpClient.newHttpClient();
		static final int MAX_AGE_SECONDS = 60;
		static final String fetchURLPattern = "https://gwcal.jku.at/gwcal/calendar/{0}?Calendar.format=ICS";

		private URI origin;
		private Instant lastFetch;
		private String data;

		RoomData(String roomID) throws URISyntaxException {
			origin = new URI(MessageFormat.format(fetchURLPattern, roomID));
			lastFetch = Instant.MIN;
		}

		synchronized void refreshIfNeeded() {
			if (lastFetch.isBefore(Instant.now().minusSeconds(MAX_AGE_SECONDS))) {
				fetchData();
				lastFetch = Instant.now();
			}
		}

		Optional<String> getData() {
			return Optional.ofNullable(data);
		}

		private void fetchData() {
			try {
				HttpRequest request = HttpRequest.newBuilder().uri(origin).GET().build();
				HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
				data = response.body();
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			} catch (IOException e) {
				// could not fetch, try again next time
			}
		}
	}

	private ConcurrentHashMap<String, RoomData> calendarCache;

	@Override
	public void init() throws ServletException {
		calendarCache = new ConcurrentHashMap<String, RoomData>();
		try {
			calendarCache.put("/merkur", new RoomData("b2ljX21lcmt1ckBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/venus", new RoomData("b2ljX3ZlbnVzQGprdS5hdD9jbj1DYWxlbmRhcg"));
			calendarCache.put("/erde", new RoomData("b2ljX2VyZGVAamt1LmF0P2NuPUNhbGVuZGFy"));
			calendarCache.put("/mars", new RoomData("b2ljX21hcnNAamt1LmF0P2NuPUNhbGVuZGFy"));
			calendarCache.put("/jupiter", new RoomData("b2ljX2p1cGl0ZXJAamt1LmF0P2NuPUNhbGVuZGFy"));
			calendarCache.put("/saturn", new RoomData("b2ljX3NhdHVybkBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/uranus", new RoomData("b2ljX3VyYW51c0Bqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/neptun", new RoomData("b2ljX25lcHR1bkBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/bumblebee", new RoomData("b2ljX2J1bWJsZWJlZUBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/eve", new RoomData("b2ljX2V2ZUBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/optimus-prime", new RoomData("b2ljX29wdGltdXNfcHJpbWVAamt1LmF0P2NuPUNhbGVuZGFy"));
			calendarCache.put("/seminar-room", new RoomData("b2ljX3NlbWluYXItcm9vbUBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/wall-e", new RoomData("b2ljX3dhbGwtZUBqa3UuYXQ_Y249Q2FsZW5kYXI"));
		} catch (URISyntaxException e) {
			throw new ServletException("invalid room URL", e);
		}
	}

	public void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
		// check for valid url room key
		String roomKey = request.getPathInfo();
		RoomData roomData = calendarCache.get(roomKey);
		if (roomData == null) {
			response.sendError(HttpServletResponse.SC_NOT_FOUND, "The requested room does not exist.");
			return;
		}

		// refresh data if needed and then send if it exists
		roomData.refreshIfNeeded();
		Optional<String> calData = roomData.getData();
		if (calData.isEmpty()) {
			response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE,
					"The calendar data for the requested room is currently not available.");
			return;
		}
		response.setContentType("text/calendar");
		response.getWriter().write(calData.get());
	}
}

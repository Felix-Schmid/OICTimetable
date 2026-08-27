import java.io.*;
import java.net.*;
import java.net.http.*;
import java.text.MessageFormat;
import java.util.Optional;
import java.util.Objects;
import java.util.concurrent.*;

import jakarta.servlet.*;
import jakarta.servlet.http.*;

public class OICRoomsServlet extends HttpServlet {

	private static class RoomData {

		static final HttpClient client = HttpClient.newHttpClient();
		static final String fetchURLPattern = "https://gwcal.jku.at/gwcal/calendar/{0}";

		private final URI origin;
		private final String id;
		private String data;

		RoomData(String id, String fetchID) throws URISyntaxException {
			this.id = id;
			origin = new URI(MessageFormat.format(fetchURLPattern, fetchID));
		}

		Optional<String> getData() {
			return Optional.ofNullable(data);
		}

		private void fetchData() {
			try {
				HttpRequest request = HttpRequest.newBuilder().uri(origin).GET().build();
				HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
				String tmp = response.body();

				if (!Objects.equals(tmp, data)) {
					SSEServlet.broadcastEvent("calendarUpdate", id);
					data = tmp;
				}
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			} catch (IOException e) {
				// could not fetch, try again next time
			}
		}
	}

	static final int REFRESH_INTERVAL_SECONDS = 60;
	private ConcurrentHashMap<String, RoomData> calendarCache;

	@Override
	public void init() throws ServletException {
		calendarCache = new ConcurrentHashMap<String, RoomData>();
		try {
			calendarCache.put("/merkur", new RoomData("merkur", "b2ljX21lcmt1ckBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/venus", new RoomData("venus", "b2ljX3ZlbnVzQGprdS5hdD9jbj1DYWxlbmRhcg"));
			calendarCache.put("/erde", new RoomData("erde", "b2ljX2VyZGVAamt1LmF0P2NuPUNhbGVuZGFy"));
			calendarCache.put("/mars", new RoomData("mars", "b2ljX21hcnNAamt1LmF0P2NuPUNhbGVuZGFy"));
			calendarCache.put("/jupiter", new RoomData("jupiter", "b2ljX2p1cGl0ZXJAamt1LmF0P2NuPUNhbGVuZGFy"));
			calendarCache.put("/saturn", new RoomData("saturn", "b2ljX3NhdHVybkBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/uranus", new RoomData("uranus", "b2ljX3VyYW51c0Bqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/neptun", new RoomData("neptun", "b2ljX25lcHR1bkBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/bumblebee", new RoomData("bumblebee", "b2ljX2J1bWJsZWJlZUBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/eve", new RoomData("eve", "b2ljX2V2ZUBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/optimus-prime", new RoomData("optimus-prime", "b2ljX29wdGltdXNfcHJpbWVAamt1LmF0P2NuPUNhbGVuZGFy"));
			calendarCache.put("/seminar-room", new RoomData("seminar-room", "b2ljX3NlbWluYXItcm9vbUBqa3UuYXQ_Y249Q2FsZW5kYXI"));
			calendarCache.put("/wall-e", new RoomData("wall-e", "b2ljX3dhbGwtZUBqa3UuYXQ_Y249Q2FsZW5kYXI"));
		} catch (URISyntaxException e) {
			throw new ServletException("invalid room URL", e);
		}

		// periodic refresh of calendars
		ScheduledExecutorService refresh = Executors.newSingleThreadScheduledExecutor();
		refresh.scheduleAtFixedRate(() -> {
			for (var calendar : calendarCache.values()) {
				calendar.fetchData();
			}
		}, 0, REFRESH_INTERVAL_SECONDS, TimeUnit.SECONDS); // initial delay: 0
	}

	public void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
		// check for valid url room key
		String roomKey = request.getPathInfo();
		RoomData roomData = calendarCache.get(roomKey);
		if (roomData == null) {
			response.sendError(HttpServletResponse.SC_NOT_FOUND, "The requested room does not exist.");
			return;
		}

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

import java.io.*;
import java.net.*;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.*;
import jakarta.servlet.http.*;

@WebServlet(urlPatterns = "/events", asyncSupported = true)
public class SSEServlet extends HttpServlet {

	// Thread-safe set of all connected clients
	private static final Set<AsyncContext> clients = ConcurrentHashMap.newKeySet();

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("text/event-stream");
		resp.setCharacterEncoding("UTF-8");
		resp.setHeader("Cache-Control", "no-cache");
		resp.setHeader("Connection", "keep-alive");
		resp.flushBuffer();

		AsyncContext async = req.startAsync();
		async.setTimeout(0); // no timeout

		async.addListener(new AsyncListener() {
			@Override
			public void onComplete(AsyncEvent e) {
				clients.remove(async);
			}

			@Override
			public void onTimeout(AsyncEvent e) {
				clients.remove(async);
				try { async.complete(); } catch (Exception ignored) {}
			}

			@Override
			public void onError(AsyncEvent e) {
				clients.remove(async);
				try { async.complete(); } catch (Exception ignored) {}
			}

			@Override
			public void onStartAsync(AsyncEvent e) {}
		});

		clients.add(async);
	}

	/**
	 * Notify all clients with a new event
	 * @param eventName the name of the event to be broadcast
	 * @param eventData the data for the event
	 */
	public static void broadcastEvent(String eventName, String eventData) {
		String sseMessage = "event: " + eventName + "\ndata: " + eventData + "\n\n";

		for (AsyncContext async : clients) {
			boolean failed = false;
			try {
				PrintWriter writer = async.getResponse().getWriter();
				writer.write(sseMessage);
				writer.flush();
				failed = writer.checkError();
			} catch (Exception e) {
				failed = true;
			} finally {
				if (failed) {
					clients.remove(async);
					try { async.complete(); } catch (Exception ignored) {}
				}
			}
		}
	}
}

#!/usr/bin/env python3
"""Static server for the Maison Arc site — disables all caching so the
preview always reflects the current files on disk."""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # append cache-control into the buffer (after the status line,
        # before the blank line) so every response is guaranteed fresh
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class ThreadingNoServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    with ThreadingNoServer(('0.0.0.0', PORT), Handler) as httpd:
        print(f'Serving on http://0.0.0.0:{PORT}', flush=True)
        httpd.serve_forever()

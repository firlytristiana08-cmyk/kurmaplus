#!/usr/bin/env python3
"""Server statis dengan Cache-Control yang tepat: teks selalu diperiksa ulang
(no-cache), gambar/font boleh di-cache lama (immutable) agar pembaruan
tampilan tidak tertinggal di cache browser."""

import http.server
import os
import socketserver

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        path = self.path.split("?", 1)[0].lower()
        if path.endswith(("/", ".html", ".htm", ".css", ".js", ".webmanifest")):
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("0.0.0.0", 4173), Handler) as httpd:
        httpd.serve_forever()

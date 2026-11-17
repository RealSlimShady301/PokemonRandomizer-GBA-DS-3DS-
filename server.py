"""Lokale helper voor de Pokémon Randomizer.

Start de app op http://127.0.0.1:8765 en voegt de functie "Stuur naar 3DS" toe:
de LayeredFS-bestanden worden via FTP (de 3DS-app FTPD) rechtstreeks op de SD-kaart
van je 3DS gezet. Alleen bereikbaar vanaf deze pc zelf.
"""
import base64
import ftplib
import io
import ipaddress
import json
import os
import posixpath
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))


def ftp_upload(host, port, files):
    ip = ipaddress.ip_address(host)
    if not (ip.is_private or ip.is_loopback):
        raise ValueError("Alleen adressen in je eigen netwerk zijn toegestaan (bv. 192.168.x.x).")
    ftp = ftplib.FTP()
    ftp.connect(host, port, timeout=20)
    ftp.login()  # FTPD op de 3DS accepteert anoniem inloggen
    ftp.set_pasv(True)
    sent = []
    try:
        for f in files:
            path = posixpath.normpath("/" + f["path"].lstrip("/"))
            if ".." in path.split("/"):
                raise ValueError("Ongeldig pad: " + path)
            folder, name = posixpath.split(path)
            ftp.cwd("/")
            for part in [p for p in folder.split("/") if p]:
                try:
                    ftp.cwd(part)
                except ftplib.error_perm:
                    ftp.mkd(part)
                    ftp.cwd(part)
            data = base64.b64decode(f["b64"])
            ftp.storbinary("STOR " + name, io.BytesIO(data))
            sent.append({"path": path, "bytes": len(data)})
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()
    return sent


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/ping":
            return self._json(200, {"ok": True})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/ftp":
            return self._json(404, {"ok": False, "error": "onbekend"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            req = json.loads(self.rfile.read(n))
            sent = ftp_upload(req["host"].strip(), int(req.get("port") or 5000), req["files"])
            self._json(200, {"ok": True, "sent": sent})
        except (OSError, ftplib.Error) as e:
            self._json(200, {"ok": False, "error": "Geen verbinding met de 3DS (" + str(e) + "). Staat FTPD open en zitten pc en 3DS op hetzelfde wifi-netwerk?"})
        except Exception as e:
            self._json(200, {"ok": False, "error": str(e)})

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write(fmt % args + "\n")


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = "http://127.0.0.1:%d/" % PORT
    print("Pokémon Randomizer draait op " + url + "  (sluit dit venster om te stoppen)")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    srv.serve_forever()

#!/usr/bin/env python3
"""
Serveur local du site de veille.

Identique au serveur intégré de Python, à une différence près : il interdit
toute mise en cache. Sans cela, le navigateur peut continuer à afficher une
ancienne version des fichiers après une mise à jour du projet — un piège
difficile à diagnostiquer, puisque le code sur le disque est correct.
"""

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass  # sortie silencieuse : la fenêtre reste lisible


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()

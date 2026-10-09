#!/bin/sh
# DELTARUNE Fight Simulator - quick installer for the desktop app (Windows).
#   curl -fsSL https://deltarunesim.com/install.sh | sh
# Runs from Git Bash, MSYS2 or WSL. It reads the app's update feed (/desktop/latest.json), downloads the
# installer it names from deltarunesim.com, checks its SHA-256 against /desktop/SHA256SUMS, and runs it
# (a per-user install, no admin). Nothing else is downloaded or changed.
set -eu
SITE="https://deltarunesim.com"
say() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || die "curl is needed"
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*) WIN=1 ;;
  Linux*) if grep -qi microsoft /proc/version 2>/dev/null; then WIN=wsl; else die "the app is Windows-only for now - play in the browser at $SITE"; fi ;;
  *) die "the app is Windows-only for now - play in the browser at $SITE" ;;
esac
feed=$(curl -fsSL "$SITE/desktop/latest.json") || die "could not read the update feed"
url=$(printf '%s' "$feed" | tr -d '\n' | sed -n 's/.*"windows-x86_64"[^}]*"url": *"\([^"]*\)".*/\1/p')
ver=$(printf '%s' "$feed" | tr -d '\n' | sed -n 's/^[^"]*"version": *"\([^"]*\)".*/\1/p')
case "$url" in "$SITE"/desktop/*.exe) ;; *) die "unexpected installer address: $url" ;; esac
name=${url##*/}
sums=$(curl -fsSL "$SITE/desktop/SHA256SUMS") || die "could not read the checksums"
want=$(printf '%s\n' "$sums" | awk -v n="$name" '$2 == n || $2 == "*" n { print $1 }')
[ -n "$want" ] || die "no checksum listed for $name"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
say "Downloading DELTARUNE Fight Simulator $ver..."
curl -fL --progress-bar -o "$tmp/$name" "$SITE/api/dl?f=setup&src=sh" || die "download failed"
if command -v sha256sum >/dev/null 2>&1; then got=$(sha256sum "$tmp/$name" | cut -d' ' -f1); else got=$(shasum -a 256 "$tmp/$name" | cut -d' ' -f1); fi
[ "$got" = "$want" ] || die "checksum mismatch ($got) - not running it"
say "Checksum OK ($want)"
say "Installing..."
if [ "$WIN" = wsl ]; then
  win=$(wslpath -w "$tmp/$name"); powershell.exe -NoProfile -Command "Start-Process -Wait -FilePath '$win'"
else
  "$tmp/$name"
fi
say "Done. The app opens on its own; next time, start it from the Start menu."

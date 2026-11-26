#!/usr/bin/env bash
# Saves every .docx in a folder as PDF with Microsoft Word (macOS), next to the .docx.
#   tools/guide/docx-to-pdf.sh <folder>
#
# Word is sandboxed: opening a file elsewhere makes it ask "Grant File Access" for every single file. The documents are therefore
# copied into Word's own container (which it may always read and write), converted there, and the PDFs copied back.
set -euo pipefail
dir=$(cd "${1:?folder with .docx files}" && pwd)
work="$HOME/Library/Containers/com.microsoft.Word/Data/Documents/docx-to-pdf-$$"
mkdir -p "$work"
trap 'rm -rf "$work"' EXIT
for f in "$dir"/*.docx; do
  [ -e "$f" ] || continue
  case "$(basename "$f")" in '~$'*) continue ;; esac
  cp "$f" "$work/"
  src="$work/$(basename "$f")"
  pdf="${src%.docx}.pdf"
  osascript <<EOF
with timeout of 600 seconds
  tell application "Microsoft Word"
    set d to open file name (POSIX file "$src" as string)
    delay 1
    save as d file name (POSIX file "$pdf" as string) file format format PDF
    close d saving no
  end tell
end timeout
EOF
  cp "$pdf" "$dir/"
  echo "$dir/$(basename "$pdf")"
done

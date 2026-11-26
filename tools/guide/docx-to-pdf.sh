#!/usr/bin/env bash
# Saves every .docx in a folder as PDF with Microsoft Word (macOS). Word asks once for access to the folder ("Grant Access").
#   tools/guide/docx-to-pdf.sh guide-out/docx
set -euo pipefail
dir=$(cd "${1:?folder with .docx files}" && pwd)
for f in "$dir"/*.docx; do
  [ -e "$f" ] || continue
  case "$(basename "$f")" in '~$'*) continue ;; esac
  pdf="${f%.docx}.pdf"
  osascript <<EOF
tell application "Microsoft Word"
  set d to open file name (POSIX file "$f" as string)
  delay 1
  save as d file name (POSIX file "$pdf" as string) file format format PDF
  close d saving no
end tell
EOF
  echo "$pdf"
done

#!/usr/bin/env bash
# read projects current directory with $PWD
cd /Users/adamtyoung/calendars
git add -A
git commit -m "Commit from shell"
git push origin --all

echo 'Committed'

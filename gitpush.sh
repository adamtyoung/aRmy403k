#!/usr/bin/env bash
# read projects current directory with $PWD
git add --all
git commit -m "Commit from shell"
git push origin --all

echo 'Committed'

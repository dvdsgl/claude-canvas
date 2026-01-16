@echo off
REM Batch wrapper script for claude-canvas on Windows
REM Equivalent to run-canvas.sh for Unix systems

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0

REM Run the CLI using Bun
bun run "%SCRIPT_DIR%src\cli.ts" %*

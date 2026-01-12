# PowerShell wrapper script for claude-canvas on Windows
# Equivalent to run-canvas.sh for Unix systems

param(
    [Parameter(Position=0, ValueFromRemainingArguments=$true)]
    [string[]]$Arguments
)

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Run the CLI using Bun
& bun run "$ScriptDir\src\cli.ts" @Arguments

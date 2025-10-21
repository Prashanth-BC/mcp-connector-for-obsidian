@echo off
REM Start the MCP WebSocket Bridge Server
REM This script kills any existing bridge process before starting a new one

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "BRIDGE_SCRIPT=%SCRIPT_DIR%mcp-http-ws-bridge.js"

echo [Bridge] Checking for existing bridge processes...

REM Kill existing node processes running the bridge
set FOUND=0
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /NH 2^>nul') do (
    set "PID=%%a"
    wmic process where "ProcessId=!PID!" get CommandLine 2>nul | findstr /C:"mcp-http-ws-bridge.js" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [Bridge] Found existing bridge process: !PID!
        echo [Bridge] Killing process !PID!...
        taskkill /F /PID !PID! >nul 2>&1
        set FOUND=1
    )
)

if !FOUND! equ 0 (
    echo [Bridge] No existing bridge processes found
)

REM Wait a moment for processes to terminate
timeout /t 1 /nobreak >nul 2>&1

REM Check if bridge script exists
if not exist "%BRIDGE_SCRIPT%" (
    echo [Bridge] Error: Bridge script not found at %BRIDGE_SCRIPT%
    pause
    exit /b 1
)

REM Start the bridge server
echo [Bridge] Starting WebSocket bridge server...
echo [Bridge] Script location: %BRIDGE_SCRIPT%
echo.

node "%BRIDGE_SCRIPT%"

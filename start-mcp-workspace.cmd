@echo off
setlocal enabledelayedexpansion

REM MCP Connector Workspace Launcher
REM Starts the bridge server and Claude Code in separate terminal tabs

set "SCRIPT_DIR=%~dp0"
set "PLUGIN_DIR=%SCRIPT_DIR%.obsidian\plugins\mcp-connector"
set "BRIDGE_SCRIPT=%PLUGIN_DIR%\mcp-http-ws-bridge.js"

echo =========================================
echo MCP Connector Workspace Launcher
echo =========================================
echo.

echo script directory: "%SCRIPT_DIR%"

echo Starting MCP Connector workspace...
echo.
echo Opening two terminal windows:
echo   1. Bridge Server
echo   2. Claude Code
echo.

    echo Using standard Command Prompt...
    REM Fallback to standard cmd windows
    start "MCP Bridge Server" cmd /k "echo === MCP Bridge Server === && echo. && cd /d "%PLUGIN_DIR%" && node "%BRIDGE_SCRIPT%""

    REM Wait a moment before starting Claude
    timeout /t 2 /NOBREAK

    start "Claude Code" cmd /k "echo === Claude Code === && echo Waiting for bridge to start... && timeout /t 3 /NOBREAK && echo. && cd /d "%SCRIPT_DIR%" && claude"

    echo.
    echo [OK] Workspace started in separate windows
    echo.
    echo Two Command Prompt windows have been opened:
    echo   1. MCP Bridge Server
    echo   2. Claude Code
    echo.
    echo To stop the workspace, close both windows.
    echo.

echo Ready to use! Check the Claude Code window to start working.
echo.
pause

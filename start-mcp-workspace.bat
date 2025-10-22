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

REM Check for Node.js
node --version >NUL 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed.
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check for Claude Code
claude --version >NUL 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Claude Code CLI is not installed.
    echo Please install Claude Code from: https://claude.ai/code
    pause
    exit /b 1
)

REM Check if bridge script exists
if not exist "%BRIDGE_SCRIPT%" (
    echo Error: Bridge script not found at: %BRIDGE_SCRIPT%
    echo Please ensure the MCP Connector plugin is installed in this vault.
    pause
    exit /b 1
)

echo Starting MCP Connector workspace...
echo.
echo Opening two terminal windows:
echo   1. Bridge Server
echo   2. Claude Code
echo.

REM Detect Windows Terminal
wt --version >NUL 2>&1
if %ERRORLEVEL% equ 0 (
    echo Using Windows Terminal...
    REM Use Windows Terminal with split panes
    start "" wt -w 0 new-tab --title "MCP Bridge" cmd /k "echo === MCP Bridge Server === && echo. && cd /d "%PLUGIN_DIR%" && node "%BRIDGE_SCRIPT%"" ; split-pane --title "Claude Code" cmd /k "echo === Claude Code === && echo Waiting for bridge to start... && timeout /t 3 /NOBREAK && echo. && cd /d "%SCRIPT_DIR%" && claude"
    echo.
    echo [OK] Workspace started in Windows Terminal
    echo.
    echo The workspace has two panes:
    echo   - Left: Bridge Server
    echo   - Right: Claude Code
    echo.
    echo Windows Terminal shortcuts:
    echo   Alt+Shift+D      Split pane
    echo   Alt+Arrow        Move between panes
    echo   Ctrl+Shift+W     Close pane
    echo.
) else (
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
)

echo Ready to use! Check the Claude Code window to start working.
echo.
pause

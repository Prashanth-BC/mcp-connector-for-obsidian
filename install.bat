@echo off
setlocal enabledelayedexpansion

REM MCP Connector for Obsidian - Installation Script
REM This script downloads, builds, and installs the plugin to your vault

set "REPO_URL=https://github.com/Prashanth-BC/mcp-connector-for-obsidian/archive/refs/heads/main.zip"
set "PLUGIN_NAME=mcp-connector"
set "TEMP_DIR=%TEMP%\%PLUGIN_NAME%-install"

echo =========================================
echo MCP Connector for Obsidian - Installer
echo =========================================
echo.

REM Check for required tools
echo Checking dependencies...

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js and try again.
    echo Download from: https://nodejs.org/
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: npm is not installed. Please install npm and try again.
    exit /b 1
)

where curl >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: curl is not installed. Please install curl and try again.
    echo Windows 10 1803+ has curl built-in. For older versions, download from: https://curl.se/windows/
    exit /b 1
)

where tar >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: tar is not installed. Please install tar and try again.
    echo Windows 10 has tar built-in. For older versions, install 7-Zip or similar.
    exit /b 1
)

echo [OK] All dependencies found
echo.

REM Get vault path from user
if "%~1"=="" (
    set /p "VAULT_PATH=Please enter the full path to your Obsidian vault: "
) else (
    set "VAULT_PATH=%~1"
)

if not exist "!VAULT_PATH!" (
    echo Error: Vault path does not exist: !VAULT_PATH!
    exit /b 1
)

echo Using vault path: !VAULT_PATH!
echo.

REM Download and build
echo Downloading repository...
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

curl -L "%REPO_URL%" -o "%TEMP_DIR%\repo.zip"
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to download repository
    exit /b 1
)

echo.
echo Extracting files...
cd /d "%TEMP_DIR%"
tar -xf repo.zip
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to extract files
    exit /b 1
)

cd mcp-connector-for-obsidian-main

echo.
echo Installing dependencies...
call npm ci
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to install dependencies
    exit /b 1
)

echo.
echo Building plugin...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to build plugin
    exit /b 1
)

echo [OK] Build completed successfully
echo.

REM Install to vault
set "PLUGIN_DIR=!VAULT_PATH!\.obsidian\plugins\%PLUGIN_NAME%"

echo Installing to vault...
if not exist "!VAULT_PATH!\.obsidian\plugins" mkdir "!VAULT_PATH!\.obsidian\plugins"

if exist "!PLUGIN_DIR!" (
    echo Warning: Plugin directory already exists. Backing up to !PLUGIN_DIR!.backup
    if exist "!PLUGIN_DIR!.backup" rd /s /q "!PLUGIN_DIR!.backup"
    move "!PLUGIN_DIR!" "!PLUGIN_DIR!.backup" >nul
)

xcopy /E /I /Y "%TEMP_DIR%\mcp-connector-for-obsidian-main\%PLUGIN_NAME%" "!PLUGIN_DIR!" >nul
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to copy plugin files
    exit /b 1
)

echo [OK] Plugin installed to: !PLUGIN_DIR!
echo.

REM Cleanup
echo Cleaning up temporary files...
cd /d "%TEMP%"
rd /s /q "%TEMP_DIR%"
echo [OK] Cleanup completed
echo.

echo =========================================
echo Installation Complete!
echo =========================================
echo.
echo Next steps:
echo 1. Open Obsidian and go to Settings -^> Community plugins
echo 2. Enable 'MCP Connector'
echo 3. Start the bridge server:
echo    !PLUGIN_DIR!\start-bridge.cmd
echo.
echo For more information, visit:
echo https://github.com/Prashanth-BC/mcp-connector-for-obsidian
echo.

pause

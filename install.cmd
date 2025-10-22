@echo off
setlocal enabledelayedexpansion

REM MCP Connector for Obsidian - Installation Script
REM This script downloads, builds, and installs the plugin to your vault

set "REPO_URL=https://github.com/Prashanth-BC/mcp-connector-for-obsidian/archive/refs/heads/main.zip"
set "PLUGIN_NAME=mcp-connector"
set "TEMP_DIR=%CD%\%PLUGIN_NAME%-install-%RANDOM%-%RANDOM%"

echo =========================================
echo MCP Connector for Obsidian - Installer
echo =========================================
echo.

REM Check for required tools
echo.
echo ========================================
echo Step 1: Checking dependencies
echo ========================================
echo.

echo Checking Node.js...
node --version
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found
echo.



echo ========================================
echo Step 2: Setting vault path
echo ========================================
echo.

REM Get vault path from user
if "%~1"=="" (
    set "VAULT_PATH=%CD%"
    echo No vault path argument provided
    echo Using current directory as vault
) else (
    set "VAULT_PATH=%~1"
    echo Using provided vault path
)

if not exist "!VAULT_PATH!" (
    echo [ERROR] Vault path does not exist: !VAULT_PATH!
    pause
    exit /b 1
)

echo Vault path: !VAULT_PATH!
echo [OK] Vault path verified
echo.

echo ========================================
echo Step 3: Downloading repository
echo ========================================
echo.
echo Repository URL: %REPO_URL%
echo Temporary directory: %TEMP_DIR%
echo.

echo Creating temporary directory...
mkdir "%TEMP_DIR%"
if errorlevel 1 (
    echo [ERROR] Failed to create temporary directory
    pause
    exit /b 1
)
echo [OK] Temporary directory created
echo.

echo Downloading repository archive...
curl -L "%REPO_URL%" -o "%TEMP_DIR%\repo.zip"
if errorlevel 1 (
    echo [ERROR] Failed to download repository
    goto :cleanup_and_exit
)
echo [OK] Download complete
echo.

echo ========================================
echo Step 4: Extracting files
echo ========================================
echo.

cd /d "%TEMP_DIR%"
echo Extracting archive...
tar -xf repo.zip
if errorlevel 1 (
    echo [ERROR] Failed to extract files
    goto :cleanup_and_exit
)
echo [OK] Files extracted
echo.

cd mcp-connector-for-obsidian-main
echo Changed to extracted directory
echo.

echo ========================================
echo Step 5: Installing dependencies
echo ========================================
echo.

echo Running npm ci...
call npm ci --quiet --no-progress
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    goto :cleanup_and_exit
)
echo [OK] Dependencies installed
echo.

echo ========================================
echo Step 6: Building plugin
echo ========================================
echo.

echo Running npm build...
call npm run build
if errorlevel 1 (
    echo [ERROR] Failed to build plugin
    goto :cleanup_and_exit
)
echo [OK] Plugin built successfully
echo.

echo ========================================
echo Step 7: Cleaning up build artifacts
echo ========================================
echo.

REM Remove node_modules from temp directory to save space
if exist node_modules (
    echo Removing node_modules...
    rd /s /q node_modules
    echo [OK] node_modules removed
)

REM Remove downloaded zip
if exist "%TEMP_DIR%\repo.zip" (
    echo Removing downloaded archive...
    del /q "%TEMP_DIR%\repo.zip"
    echo [OK] Archive removed
)
echo.

echo ========================================
echo Step 8: Installing to vault
echo ========================================
echo.

set "PLUGIN_DIR=!VAULT_PATH!\.obsidian\plugins\%PLUGIN_NAME%"
echo Plugin directory: !PLUGIN_DIR!
echo.

if not exist "!VAULT_PATH!\.obsidian\plugins" (
    echo [DEBUG] Creating plugins directory: !VAULT_PATH!\.obsidian\plugins
    mkdir "!VAULT_PATH!\.obsidian\plugins"
    if errorlevel 1 (
        echo [ERROR] Failed to create plugins directory: !VAULT_PATH!\.obsidian\plugins
        goto :cleanup_and_exit
    )
    echo [OK] Plugins directory created
)

if exist "!PLUGIN_DIR!" (
    echo [WARNING] Plugin directory already exists
    echo Creating backup...
    if exist "!PLUGIN_DIR!.backup" rd /s /q "!PLUGIN_DIR!.backup"
    move "!PLUGIN_DIR!" "!PLUGIN_DIR!.backup"
    if errorlevel 1 (
        echo [ERROR] Failed to create backup of existing plugin directory
        goto :cleanup_and_exit
    )
    echo [OK] Backup created at !PLUGIN_DIR!.backup
    echo.
)

echo [DEBUG] Copying plugin files from "%TEMP_DIR%\mcp-connector-for-obsidian-main\%PLUGIN_NAME%" to "!PLUGIN_DIR!"
xcopy /E /I /Y /Q "%TEMP_DIR%\mcp-connector-for-obsidian-main\%PLUGIN_NAME%" "!PLUGIN_DIR!"
if errorlevel 1 (
    echo [ERROR] Failed to copy plugin files
    goto :cleanup_and_exit
)
echo [OK] Plugin files copied
echo.

echo Copying workspace launcher...
REM Try .cmd first, fallback to .bat for backward compatibility
if exist "%TEMP_DIR%\mcp-connector-for-obsidian-main\start-mcp-workspace.cmd" (
    copy /Y "%TEMP_DIR%\mcp-connector-for-obsidian-main\start-mcp-workspace.cmd" "!VAULT_PATH!\start-mcp-workspace.cmd"
    if errorlevel 1 (
        echo [ERROR] Failed to copy workspace launcher
        goto :cleanup_and_exit
    )
    echo [OK] Workspace launcher copied to vault root ^(start-mcp-workspace.cmd^)
) else (
    if exist "%TEMP_DIR%\mcp-connector-for-obsidian-main\start-mcp-workspace.bat" (
        copy /Y "%TEMP_DIR%\mcp-connector-for-obsidian-main\start-mcp-workspace.bat" "!VAULT_PATH!\start-mcp-workspace.cmd"
        if errorlevel 1 (
            echo [ERROR] Failed to copy workspace launcher
            goto :cleanup_and_exit
        )
        echo [OK] Workspace launcher copied to vault root ^(from .bat^)
    ) else (
        echo [ERROR] Workspace launcher not found in downloaded repository
        goto :cleanup_and_exit
    )
)
echo.

echo ========================================
echo Step 9: Final cleanup
echo ========================================
echo.

REM Go back to vault directory before cleanup
cd /d "!VAULT_PATH!"
if exist "%TEMP_DIR%" (
    echo Removing temporary directory...
    rd /s /q "%TEMP_DIR%"
    if errorlevel 1 (
        echo [WARNING] Could not remove temporary directory
        echo Please manually delete: %TEMP_DIR%
    ) else (
        echo [OK] Temporary files removed
    )
)
echo.

echo =========================================
echo Installation Complete!
echo =========================================
echo.
echo Next steps:
echo 1. Open Obsidian and go to Settings -^> Community plugins
echo 2. Enable 'MCP Connector'
echo 3. Launch the workspace:
echo    cd /d "!VAULT_PATH!"
echo    start-mcp-workspace.cmd ^(or double-click it in the vault folder^)
echo.
echo For more information, visit:
echo https://github.com/Prashanth-BC/mcp-connector-for-obsidian
echo.

pause
exit /b 0

:cleanup_and_exit
echo.
echo ========================================
echo [ERROR] Installation failed
echo ========================================
echo.
echo Cleaning up temporary files...
REM Go back to vault directory before cleanup
cd /d "!VAULT_PATH!"
if exist "%TEMP_DIR%" (
    rd /s /q "%TEMP_DIR%"
    if errorlevel 1 (
        echo [WARNING] Could not remove temporary directory
    ) else (
        echo [OK] Temporary files removed
    )
)
echo.
echo Please check the error messages above.
pause
exit /b 1

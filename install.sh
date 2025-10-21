#!/bin/bash

# MCP Connector for Obsidian - Installation Script
# This script downloads, builds, and installs the plugin to your vault

set -e

REPO_URL="https://github.com/Prashanth-BC/mcp-connector-for-obsidian/archive/refs/heads/main.zip"
PLUGIN_NAME="mcp-connector"
TEMP_DIR="/tmp/${PLUGIN_NAME}-install"

echo "========================================="
echo "MCP Connector for Obsidian - Installer"
echo "========================================="
echo ""

# Check for required tools
check_dependencies() {
    echo "Checking dependencies..."

    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        echo "Error: Neither curl nor wget is installed. Please install one and try again."
        exit 1
    fi

    if ! command -v unzip &> /dev/null; then
        echo "Error: unzip is not installed. Please install unzip and try again."
        exit 1
    fi

    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is not installed. Please install Node.js and try again."
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        echo "Error: npm is not installed. Please install npm and try again."
        exit 1
    fi

    echo "✓ All dependencies found"
    echo ""
}

# Get vault path from user
get_vault_path() {
    if [ -z "$1" ]; then
        echo "Please enter the full path to your Obsidian vault:"
        read -r VAULT_PATH
    else
        VAULT_PATH="$1"
    fi

    # Expand ~ to home directory
    VAULT_PATH="${VAULT_PATH/#\~/$HOME}"

    if [ ! -d "$VAULT_PATH" ]; then
        echo "Error: Vault path does not exist: $VAULT_PATH"
        exit 1
    fi

    echo "Using vault path: $VAULT_PATH"
    echo ""
}

# Download and build
build_plugin() {
    echo "Downloading repository..."
    rm -rf "$TEMP_DIR"
    mkdir -p "$TEMP_DIR"

    if command -v curl &> /dev/null; then
        curl -L "$REPO_URL" -o "${TEMP_DIR}/repo.zip"
    else
        wget "$REPO_URL" -O "${TEMP_DIR}/repo.zip"
    fi

    echo ""
    echo "Extracting files..."
    cd "$TEMP_DIR"
    unzip -q repo.zip
    cd mcp-connector-for-obsidian-main

    echo ""
    echo "Installing dependencies..."
    npm ci

    echo ""
    echo "Building plugin..."
    npm run build

    echo "✓ Build completed successfully"
    echo ""
}

# Install to vault
install_to_vault() {
    PLUGIN_DIR="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_NAME}"

    echo "Installing to vault..."
    mkdir -p "${VAULT_PATH}/.obsidian/plugins"

    if [ -d "$PLUGIN_DIR" ]; then
        echo "Warning: Plugin directory already exists. Backing up to ${PLUGIN_DIR}.backup"
        rm -rf "${PLUGIN_DIR}.backup"
        mv "$PLUGIN_DIR" "${PLUGIN_DIR}.backup"
    fi

    cp -r "${TEMP_DIR}/mcp-connector-for-obsidian-main/${PLUGIN_NAME}" "$PLUGIN_DIR"

    echo "✓ Plugin installed to: $PLUGIN_DIR"
    echo ""
}

# Cleanup
cleanup() {
    echo "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
    echo "✓ Cleanup completed"
    echo ""
}

# Main installation flow
main() {
    check_dependencies
    get_vault_path "$1"
    build_plugin
    install_to_vault
    cleanup

    echo "========================================="
    echo "Installation Complete!"
    echo "========================================="
    echo ""
    echo "Next steps:"
    echo "1. Open Obsidian and go to Settings → Community plugins"
    echo "2. Enable 'MCP Connector'"
    echo "3. Start the bridge server:"
    echo "   ${PLUGIN_DIR}/start-bridge.sh"
    echo ""
    echo "For more information, visit:"
    echo "https://github.com/Prashanth-BC/mcp-connector-for-obsidian"
    echo ""
}

# Run installation
main "$@"

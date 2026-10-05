#!/bin/bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Iniciando Backend..."
gnome-terminal --title="Backend" -- bash -c "export NVM_DIR=\$HOME/.nvm; [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"; cd '$BASE_DIR/Backend' && node src/server.js; exec bash" &

echo "Iniciando Frontend..."
gnome-terminal --title="Frontend" -- bash -c "export NVM_DIR=\$HOME/.nvm; [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"; cd '$BASE_DIR/Frontend' && npm start; exec bash" &

echo "Ambos servicios iniciados."

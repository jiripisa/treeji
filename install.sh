#!/bin/bash
set -e

INSTALL_DIR="${HOME}/.treeji"

echo "Installing treeji..."

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
  echo "Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --quiet
else
  git clone --quiet https://github.com/jiripisa/treeji.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Build
npm install --silent
npm run build --silent

# Link globally
npm link --silent 2>/dev/null || sudo npm link --silent

echo ""
echo "✓ treeji installed"
echo ""
echo "Next steps:"
echo "  treeji setup >> ~/.zshrc && source ~/.zshrc"
echo "  treeji configure"

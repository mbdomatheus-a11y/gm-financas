#!/bin/sh
# Xcode Cloud: roda logo depois de clonar o repositório, antes de compilar.
set -e
cd "$CI_PRIMARY_REPOSITORY_PATH"
brew install node || true
npm install --no-audit --no-fund
npx cap sync ios
cd ios/App
pod install

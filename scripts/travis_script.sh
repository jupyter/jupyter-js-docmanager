#!/bin/bash
export DISPLAY=:99.0
sh -e /etc/init.d/xvfb start
set -ex

npm run clean
npm run build
npm test
npm run test:coverage
npm run build:example
export PATH="$HOME/miniconda/bin:$PATH"
npm run docs


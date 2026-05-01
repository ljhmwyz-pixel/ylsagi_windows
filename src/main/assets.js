const path = require('node:path');

function assetPath(name) {
  return path.join(__dirname, '..', '..', 'assets', name);
}

module.exports = {
  assetPath
};

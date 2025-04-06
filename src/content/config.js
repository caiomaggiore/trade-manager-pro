const fs = require('fs');
const path = require('path');

const userConfigPath = path.join(__dirname, '..', '..', 'config', 'user.json');
const defaultConfigPath = path.join(__dirname, '..', '..', 'config', 'default.json');

function loadConfig() {
    if (fs.existsSync(userConfigPath)) {
        const userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
        if (Object.keys(userConfig).length === 0) {
            const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
            return defaultConfig;
        }
        return userConfig;
    } else {
        const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
        return defaultConfig;
    }
}

function saveConfig(config) {
    fs.writeFileSync(userConfigPath, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = { loadConfig, saveConfig }; 
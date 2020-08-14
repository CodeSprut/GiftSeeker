jest.mock("electron", () => ({
  get app() {
    return {};
  },
}));

jest.mock("../../../../src/app/settings.js");
const settings = require("../../../../src/app/settings");

const currentSettings = {};

settings.set.mockImplementation((key, val) => (currentSettings[key] = val));

settings.get.mockImplementation((key, defaultValue) => {
  if (currentSettings[key] !== undefined) return currentSettings[key];
  if (defaultValue !== undefined) return defaultValue;

  return false;
});

settings.setup = data => Object.assign(currentSettings, data);

module.exports = settings;

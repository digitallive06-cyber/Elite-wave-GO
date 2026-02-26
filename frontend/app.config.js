const { withGradleProperties } = require('expo/config-plugins');

// Add Kotlin version compatibility suppression
const withKotlinCompat = (config) => {
  return withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'kotlin.suppressKotlinVersionCompatibilityCheck',
      value: 'true',
    });
    return config;
  });
};

module.exports = ({ config }) => {
  // Apply the Kotlin compatibility plugin
  return withKotlinCompat(config);
};

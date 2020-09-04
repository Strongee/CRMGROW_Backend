const assistantLog = (content) => {
  return `${content} (assistant)`;
};

const autoSettingLog = (content) => {
  return `${content} (auto setting)`;
};

const automationLog = (content) => {
  return `${content} (automation)`;
};

const apiLog = (content) => {
  return `${content} (api)`;
};

module.exports = {
  assistantLog,
  autoSettingLog,
  automationLog,
  apiLog,
};

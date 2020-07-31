const assistantLog = (content) => {
  return `${content} (assistant)`;
};

const autoSettingLog = (content) => {
  return `${content} (auto setting)`;
};

const automationLog = (content) => {
  return `${content} (automation)`;
};

module.exports = {
  assistantLog,
  autoSettingLog,
  automationLog,
};

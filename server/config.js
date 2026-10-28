const fs = require('fs');
const path = require('path');

// 优先级：环境变量 > server/config.local.json > 默认值。config.local.json 只放在服务器上，不要提交。
const LOCAL_FILE = path.join(__dirname, 'config.local.json');

let local = {};
try {
  if (fs.existsSync(LOCAL_FILE)) local = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
} catch (e) {
  console.error('[config] config.local.json 解析失败，已忽略：', e.message);
}

function pick(envKey, localPath, fallback) {
  if (process.env[envKey] !== undefined && process.env[envKey] !== '') return process.env[envKey];
  const v = localPath.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), local);
  return v !== undefined && v !== '' ? v : fallback;
}

const config = {
  llm: {
    baseUrl: String(pick('PAWLOG_LLM_BASE_URL', 'llm.baseUrl', '')).replace(/\/+$/, ''),
    apiKey: pick('PAWLOG_LLM_API_KEY', 'llm.apiKey', ''),
    model: pick('PAWLOG_LLM_MODEL', 'llm.model', ''),
    timeoutMs: Number(pick('PAWLOG_LLM_TIMEOUT_MS', 'llm.timeoutMs', 12000)),
    historyTurns: Number(pick('PAWLOG_LLM_HISTORY', 'llm.historyTurns', 8))
  }
};

config.llm.enabled = Boolean(config.llm.baseUrl && config.llm.apiKey && config.llm.model);

module.exports = config;

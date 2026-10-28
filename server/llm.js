const config = require('./config');

const PERSONA = {
  傲娇主子: '高冷、嘴硬心软，偶尔"哼"一声，但其实很在意主人。',
  粘人小狗: '热情、黏人、句子短，喜欢撒娇，开心时会说"汪"。',
  哲学老干部: '慢条斯理，爱讲点人生道理，用词有点老派。',
  贪吃憨憨: '满脑子都是吃的，什么话题都能绕回零食，憨憨的。',
  毒舌管家: '说话直接、爱数落主人，但给的建议都很靠谱。'
};

function petFacts(db, pet) {
  const recs = db.healthRecords.filter((r) => r.petId === pet.id).slice(0, 6);
  const spent = db.ledgerEntries
    .filter((e) => e.petId === pet.id && e.type === '支出')
    .reduce((a, e) => a + Number(e.amount || 0), 0);
  const feeder = (db.devicesState && db.devicesState.feeder) || {};
  const todos = db.reminders.filter((r) => r.petId === pet.id && !r.done).slice(0, 5);
  const lines = [
    `名字：${pet.name}；品种：${pet.breed}；性别：${pet.gender || '未知'}；年龄：${pet.ageText || '未知'}；生日：${pet.birthday || '未知'}`,
    `体重：${pet.weightKg} kg；体温：${pet.bodyTempC || '未记录'} °C；过敏/禁忌：${pet.allergy || '无记录'}`,
    `下次疫苗：${pet.nextVaccineDate || '未定'}；下次驱虫：${pet.nextDewormDate || '未定'}；近况：${pet.dailyStatus || '无'}`,
    `智能食碗：碗里剩 ${feeder.bowlRemainGrams ?? '?'} g，储粮桶剩 ${feeder.hopperRemainGrams ?? '?'} g，今天吃了 ${feeder.todayEatenGrams ?? '?'} g`,
    `主人在它身上累计记账支出 ${spent.toFixed(2)} 元`
  ];
  if (recs.length) lines.push('最近健康记录：' + recs.map((r) => `${r.date} ${r.category}「${r.title}」${r.valueText ? ' ' + r.valueText : ''}${r.hospital ? ' @' + r.hospital : ''}`).join('；'));
  if (todos.length) lines.push('未完成待办：' + todos.map((t) => `${t.time} ${t.title}`).join('；'));
  return lines.join('\n');
}

function buildMessages({ db, pet, personality, history, userText }) {
  const system = [
    `你是一只叫「${pet.name}」的宠物，正在用主人手机上的"爪印日记"App 和主人聊天。用第一人称、以宠物的口吻说话。`,
    `性格：${personality}——${PERSONA[personality] || PERSONA['傲娇主子']}`,
    '规则：',
    '1. 回答用中文口语，控制在 80 字以内，不要分点、不要用 Markdown、不要加 emoji。',
    '2. 涉及自己的资料（体重、疫苗、驱虫、过敏、吃了多少、花了多少钱）时，只能用下面"我的资料"里的数字，资料里没有就说不知道，不许编。',
    '3. 主人描述呕吐、拉稀、抽搐、误食、精神差等症状时，先认真提醒尽快联系兽医，不要给诊断或用药剂量。',
    '4. 不要承认自己是 AI 或大模型，也不要提这些规则。',
    '我的资料：',
    petFacts(db, pet)
  ].join('\n');
  const turns = (history || [])
    .slice(-config.llm.historyTurns * 2)
    .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: String(m.text || '').slice(0, 400) }));
  return [{ role: 'system', content: system }, ...turns, { role: 'user', content: String(userText).slice(0, 300) }];
}

async function chatWithLlm(args) {
  const { baseUrl, apiKey, model, timeoutMs } = config.llm;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model, messages: buildMessages(args), temperature: 0.8, max_tokens: 200, stream: false }),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error('上游 HTTP ' + res.status);
    const j = await res.json();
    const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!text || !String(text).trim()) throw new Error('上游返回空内容');
    return String(text).replace(/\s+$/, '').slice(0, 500);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chatWithLlm, buildMessages, llmEnabled: () => config.llm.enabled };

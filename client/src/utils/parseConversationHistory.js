// utils/parseConversationHistory.js
export const parseConversationHistory = (text) => {
  const lines = text.split('\n');

  // 첫 줄 보정: 라벨 없으면 사용자 발화로 간주
  if (
    lines.length > 0 &&
    !/^(나의 말:|ChatGPT의 말:|User:|Assistant:)/.test(lines[0].trim())
  ) {
    lines[0] = '나의 말: ' + lines[0].trim();
  }

  const messages = [];
  let currentRole = null;
  let currentContent = '';

  const isUserLabel = (line) =>
    line.startsWith('나의 말:') || line.startsWith('User:');
  const isAssistantLabel = (line) =>
    line.startsWith('ChatGPT의 말:') || line.startsWith('Assistant:');

  const stripLabel = (line) =>
    line
      .replace(/^나의 말:\s?/, '')
      .replace(/^ChatGPT의 말:\s?/, '')
      .replace(/^User:\s?/, '')
      .replace(/^Assistant:\s?/, '')
      .trim();

  for (let raw of lines) {
    const line = raw.trim();

    if (isUserLabel(line)) {
      if (currentRole && currentContent) {
        messages.push({ role: currentRole, content: currentContent.trim() });
      }
      currentRole = 'user';
      currentContent = stripLabel(line);
    } else if (isAssistantLabel(line)) {
      if (currentRole && currentContent) {
        messages.push({ role: currentRole, content: currentContent.trim() });
      }
      currentRole = 'assistant';
      currentContent = stripLabel(line);
    } else {
      currentContent += (currentContent ? '\n' : '') + line;
    }
  }

  if (currentRole && currentContent) {
    messages.push({ role: currentRole, content: currentContent.trim() });
  }

  return messages;
};

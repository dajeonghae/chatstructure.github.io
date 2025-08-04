export const parseConversationHistory = (text) => {
  const lines = text.split('\n');

  // ✅ 첫 줄이 '나의 말:' 또는 'ChatGPT의 말:'로 시작하지 않으면 사용자 발화로 간주
  if (
    lines.length > 0 &&
    !lines[0].trim().startsWith('나의 말:') &&
    !lines[0].trim().startsWith('ChatGPT의 말:')
  ) {
    lines[0] = '나의 말: ' + lines[0].trim();
  }

  const messages = [];
  let currentRole = null;
  let currentContent = '';

  for (let line of lines) {
    line = line.trim();

    if (line.startsWith('나의 말:')) {
      // 기존 메시지 저장
      if (currentRole && currentContent) {
        messages.push({ role: currentRole, content: currentContent.trim() });
      }
      currentRole = 'user';
      currentContent = line.replace('User:', '').trim();
    } else if (line.startsWith('ChatGPT의 말:')) {
      if (currentRole && currentContent) {
        messages.push({ role: currentRole, content: currentContent.trim() });
      }
      currentRole = 'assistant';
      currentContent = line.replace('Assistant:', '').trim();
    } else {
      // 멀티라인 메시지일 경우
      currentContent += '\n' + line;
    }
  }

  // 마지막 메시지도 추가
  if (currentRole && currentContent) {
    messages.push({ role: currentRole, content: currentContent.trim() });
  }

  // 🔍 로그 확인
  console.log("파싱 끝냄");

  return messages;
};

const fs = require('fs');

const logPath = 'C:\\Users\\yoges\\.gemini\\antigravity-ide\\brain\\32006531-5116-45c9-aac1-fe4af42c1420\\.system_generated\\logs\\transcript.jsonl';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const step = JSON.parse(line);
    if (step.step_index >= 144 && step.step_index <= 165) {
      console.log(`[Step ${step.step_index}] Source: ${step.source}, Type: ${step.type}`);
      if (step.content) {
        console.log(`  Content (length ${step.content.length}):`, step.content.substring(0, 1500));
        console.log('--------------------------------------------------');
      }
    }
  }
} catch (e) {
  console.error(e);
}

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { responsesToChatCompletions } from './responses-chat-transform.js';

test('input 项省略 type 时按 message 处理, 不再被静默丢弃', () => {
  // Responses API 允许 message 项只写 role/content 不写 type。
  // 修复前这些项会被丢弃，上游收到空 messages（Gemini 系直接 400）。
  const body = {
    model: 'm',
    stream: true,
    input: [{ role: 'user', content: [{ type: 'input_text', text: '你好' }] }],
  };
  const chat = responsesToChatCompletions(body);
  assert.equal(chat.messages.length, 1);
  assert.deepEqual(chat.messages[0], { role: 'user', content: '你好' });
});

test('input 项显式 type=message 时行为不变', () => {
  const chat = responsesToChatCompletions({
    model: 'm',
    input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: '你好' }] }],
  });
  assert.equal(chat.messages.length, 1);
  assert.deepEqual(chat.messages[0], { role: 'user', content: '你好' });
});

test('纯字符串 content 的 message 项同样保留', () => {
  const chat = responsesToChatCompletions({
    model: 'm',
    input: [{ role: 'user', content: '你好' }],
  });
  assert.equal(chat.messages.length, 1);
  assert.equal(chat.messages[0].content, '你好');
});

test('function_call / function_call_output 仍然转成 tool_calls 与 tool 消息', () => {
  const chat = responsesToChatCompletions({
    model: 'm',
    input: [
      { type: 'message', role: 'user', content: '查天气' },
      { type: 'function_call', call_id: 'call-1', name: 'get_weather', arguments: '{"city":"北京"}' },
      { type: 'function_call_output', call_id: 'call-1', output: '晴' },
    ],
  });
  assert.deepEqual(chat.messages[0], { role: 'user', content: '查天气' });
  assert.equal(chat.messages[1].role, 'assistant');
  assert.equal(chat.messages[1].tool_calls[0].function.name, 'get_weather');
  assert.equal(chat.messages[2].role, 'tool');
  assert.equal(chat.messages[2].tool_call_id, 'call-1');
});

/** Strip only known UI-injected context, preserving the user's actual request. */
export function cleanUserText(raw: string): string {
  let text = raw.replace(/<in-app-browser-context\b[^>]*>[\s\S]*?<\/in-app-browser-context>/gi, '').trim();
  const request = /^## My request:\s*$/m.exec(text);
  if (request) text = text.slice(request.index + request[0].length).trim();
  // A previously truncated title cannot recover the request; don't expose the technical preamble.
  if (/^(?:<in-app-browser-context\b|# Files mentioned by the user:|<environment_context>|<send_user_message_question_reply>|# AGENTS\.md instructions)/i.test(text)) return '';
  return text;
}

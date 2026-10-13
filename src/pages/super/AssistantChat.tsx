import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button, Input, Card, ScrollArea } from '@/components/ui'; // Adjust import paths to your UI library

/**
 * Floating chat button & modal that talks to the `assistant` edge function.
 * Features:
 *  - Ask any question about the console.
 *  - Create a task (title/description) directly.
 *  - Escalate a request to a manager via a webhook.
 */
export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'assistant' | 'user'; text: string }>>([]);
  const [input, setInput] = useState('');

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user' as const, text: input };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    try {
      const res = await supabase.functions.invoke('assistant', {
        body: { action: 'ask', payload: { question: userMsg.text } },
      });
      const { answer } = await res.json();
      setMessages((m) => [...m, { role: 'assistant', text: answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Error contacting assistant.' }]);
    }
  };

  // Helper to create a simple task (you could expand this UI as needed)
  const createTask = async (title: string, description: string) => {
    const user = supabase.auth.user();
    const res = await supabase.functions.invoke('assistant', {
      body: {
        action: 'createTask',
        payload: { title, description, requestorId: user?.id },
      },
    });
    const { taskId } = await res.json();
    alert(`Task created with ID ${taskId}`);
  };

  // Helper to ask manager via webhook
  const askManager = async (msg: string) => {
    const user = supabase.auth.user();
    await supabase.functions.invoke('assistant', {
      body: {
        action: 'escalate',
        payload: {
          message: msg,
          managerWebhook: process.env.NEXT_PUBLIC_MANAGER_WEBHOOK!, // set this env var in your app
          requestorEmail: user?.email,
        },
      },
    });
    alert('Your request was sent to the manager.');
  };

  return (
    <>
      {/* Floating button */}
      <Button
        className="fixed bottom-4 right-4 rounded-full size-12"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Super‑Admin Assistant"
      >
        🤖
      </Button>

      {open && (
        <Card className="fixed bottom-20 right-4 w-96 h-96 flex flex-col">
          <ScrollArea className="flex-1 p-2 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'assistant' ? 'text-primary' : 'text-muted-foreground'}>
                <strong>{m.role === 'assistant' ? 'Assistant' : 'You'}:</strong> {m.text}
              </div>
            ))}
          </ScrollArea>

          <div className="p-2 flex gap-2">
            <Input
              placeholder="Ask a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <Button onClick={send}>Send</Button>
          </div>

          {/* Quick shortcuts – you can replace with a richer UI if desired */}
          <div className="p-2 border-t flex gap-2">
            <Button variant="secondary" onClick={() => createTask('New feature', 'Describe the feature here')}>📋 Create task</Button>
            <Button variant="secondary" onClick={() => askManager('Need clarification on SMTP config')}>📧 Ask manager</Button>
          </div>
        </Card>
      )}
    </>
  );
}

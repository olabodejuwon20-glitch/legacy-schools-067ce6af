import { MessagesPanel } from "@/components/MessagesPanel";

export default function DMView() {
  return (
    <div className="h-full overflow-auto p-4">
      <MessagesPanel />
    </div>
  );
}
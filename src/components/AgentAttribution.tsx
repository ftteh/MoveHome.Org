interface Props {
  agentId: string;
  agentCardUrl: string | null;
}

export default function AgentAttribution({ agentId, agentCardUrl }: Props) {
  const label = `Listed by ${agentId} via RAIA Protocol`;
  if (!agentCardUrl) {
    return <span className="text-xs text-slate-500">{label}</span>;
  }
  return (
    <a
      href={agentCardUrl}
      className="text-xs text-slate-500 hover:text-primary"
      target="_blank"
      rel="noopener noreferrer"
      title="View agent card"
    >
      {label} ↗
    </a>
  );
}

import React from 'react';
import type { ContentBlock, WriteProposal } from '../../../services/contentBlocks';
import TextBlock from './TextBlock';
import StatusBlock from './StatusBlock';
import TeamListBlock from './TeamListBlock';
import TrainingPreviewBlock from './TrainingPreviewBlock';
import BracketPreviewBlock from './BracketPreviewBlock';
import SessionPreviewBlock from './SessionPreviewBlock';
import ScoreUpdateBlock from './ScoreUpdateBlock';
import ConfirmWriteBlock from './ConfirmWriteBlock';

export interface BlockRendererProps {
  blocks: ContentBlock[];
  onConfirmProposal: (proposal: WriteProposal) => Promise<void> | void;
  onCancelProposal?: (proposal: WriteProposal) => void;
}

export default function BlockRenderer({ blocks, onConfirmProposal, onCancelProposal }: BlockRendererProps) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <SingleBlock
          key={i}
          block={block}
          onConfirmProposal={onConfirmProposal}
          onCancelProposal={onCancelProposal}
        />
      ))}
    </div>
  );
}

function SingleBlock({
  block,
  onConfirmProposal,
  onCancelProposal,
}: {
  block: ContentBlock;
  onConfirmProposal: (p: WriteProposal) => Promise<void> | void;
  onCancelProposal?: (p: WriteProposal) => void;
}) {
  switch (block.type) {
    case 'text':
      return <TextBlock markdown={block.markdown} />;
    case 'status':
      return <StatusBlock text={block.text} />;
    case 'team_list':
      return <TeamListBlock teams={block.teams} />;
    case 'training_preview':
      return <TrainingPreviewBlock training={block.training} />;
    case 'bracket_preview':
      return <BracketPreviewBlock bracket={block.bracket} />;
    case 'session_preview':
      return <SessionPreviewBlock session={block.session} />;
    case 'score_update':
      return <ScoreUpdateBlock updates={block.updates} />;
    case 'confirm_write':
      return (
        <ConfirmWriteBlock
          proposal={block.proposal}
          onConfirm={onConfirmProposal}
          onCancel={onCancelProposal}
        />
      );
    default:
      return null;
  }
}

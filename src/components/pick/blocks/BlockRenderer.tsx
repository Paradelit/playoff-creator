import React from 'react';
import type { AmbiguityCandidate, ContentBlock, WriteProposal } from '../../../services/contentBlocks';
import TextBlock from './TextBlock';
import StatusBlock from './StatusBlock';
import TeamListBlock from './TeamListBlock';
import TrainingPreviewBlock from './TrainingPreviewBlock';
import BracketPreviewBlock from './BracketPreviewBlock';
import SessionPreviewBlock from './SessionPreviewBlock';
import ScoreUpdateBlock from './ScoreUpdateBlock';
import ConfirmWriteBlock from './ConfirmWriteBlock';
import ConfirmChoiceBlock from './ConfirmChoiceBlock';
import ExercisePreviewBlock from './ExercisePreviewBlock';
import ConvocatoriaBlock from './ConvocatoriaBlock';

export interface BlockRendererProps {
  blocks: ContentBlock[];
  onConfirmProposal: (proposal: WriteProposal) => Promise<void> | void;
  onCancelProposal?: (proposal: WriteProposal) => void;
  /** Callback for confirm_choice blocks (sub-B.3). Typically wired to
   *  sendMessage with the resolved phrasing. If omitted, the block still
   *  renders but clicks are no-ops. */
  onPickChoice?: (candidate: AmbiguityCandidate, intent: string) => void;
}

export default function BlockRenderer({
  blocks,
  onConfirmProposal,
  onCancelProposal,
  onPickChoice,
}: BlockRendererProps) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <SingleBlock
          key={i}
          block={block}
          onConfirmProposal={onConfirmProposal}
          onCancelProposal={onCancelProposal}
          onPickChoice={onPickChoice}
        />
      ))}
    </div>
  );
}

function SingleBlock({
  block,
  onConfirmProposal,
  onCancelProposal,
  onPickChoice,
}: {
  block: ContentBlock;
  onConfirmProposal: (p: WriteProposal) => Promise<void> | void;
  onCancelProposal?: (p: WriteProposal) => void;
  onPickChoice?: (candidate: AmbiguityCandidate, intent: string) => void;
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
    case 'exercise_preview':
      return <ExercisePreviewBlock exercises={block.exercises} />;
    case 'convocatoria_preview':
      return <ConvocatoriaBlock convocatoria={block.convocatoria} />;
    case 'confirm_write':
      return <ConfirmWriteBlock proposal={block.proposal} onConfirm={onConfirmProposal} onCancel={onCancelProposal} />;
    case 'confirm_choice':
      return (
        <ConfirmChoiceBlock
          prompt={block.prompt}
          candidates={block.candidates}
          intent={block.intent}
          onPick={onPickChoice || (() => undefined)}
        />
      );
    default:
      return null;
  }
}

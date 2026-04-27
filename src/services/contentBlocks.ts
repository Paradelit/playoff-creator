/**
 * Shared Pick contracts.
 * Source of truth lives in functions/src/shared so frontend and backend keep
 * the same discriminated unions and proposal kinds.
 */
export type {
  BracketPreviewData,
  BracketRecord,
  CalendarSessionRecord,
  ContentBlock,
  PickAction,
  ExercisePreviewData,
  OrchestratorResponse,
  ScoreUpdateEntry,
  TeamListEntry,
  TrainingPreviewData,
  WriteProposal,
  WriteProposalKind,
} from '../../functions/src/shared/pickContracts';

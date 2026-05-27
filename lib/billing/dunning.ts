export function nextDunningState(failures: number): 'past_due' | 'soft_suspended' | 'hard_suspended' {
  if (failures >= 7) return 'hard_suspended';
  if (failures >= 3) return 'soft_suspended';
  return 'past_due';
}

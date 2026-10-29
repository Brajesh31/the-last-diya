export type FeedbackTone = 'info' | 'success' | 'warning';

export interface FeedbackMessage {
  text: string;
  tone: FeedbackTone;
  durationMs: number;
}

export function createFeedbackMessage(text: string, tone: FeedbackTone = 'info', durationMs = 2200): FeedbackMessage {
  return { text, tone, durationMs };
}

export function feedbackClassName(tone: FeedbackTone): string {
  return `experience-feedback experience-feedback-${tone}`;
}

export function shouldReduceFeedbackMotion(reducedMotion: boolean): boolean {
  return reducedMotion;
}

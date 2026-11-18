export type Phase = "setup" | "lobby" | "guessing" | "finale";

export type EventRow = {
  id: string;
  code: string;
  host_token: string;
  screen_token: string;
  guest_key: string;
  company_name: string;
  question: string;
  answer: number | null;
  cover_photo: string | null;
  duration_sec: number;
  phase: Phase;
  timer_ends_at: string | null;
  created_at: string;
};

export type GuessRow = {
  id: string;
  event_id: string;
  guest_token: string;
  name: string;
  value: number;
  created_at: string;
};

export type PublicGuess = {
  name: string;
  value: number;
};

export type RankedGuess = PublicGuess & {
  distance: number;
  place: number;
};

export type EventPublic = {
  code: string;
  companyName: string;
  question: string;
  coverPhoto: string | null;
  durationSec: number;
  phase: Phase;
  timerEndsAt: string | null;
  guessCount: number;
  secondsLeft: number | null;
  guesses: PublicGuess[];
  top3: RankedGuess[] | null;
  answer: number | null;
};

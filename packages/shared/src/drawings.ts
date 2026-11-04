import type { Pose, Prop } from './schema.ts';

/** What each stickman pose means, so the agent (and the editor) can match it to the words. */
export const POSE_MEANING: Record<Pose, string> = {
  thinking: 'a question, wondering, planning',
  pointing: 'look at this, a tip, "you" / call to action',
  shrug: 'confusion, "pata nahi", nobody knows',
  running: 'speed, hurry, quick results, chasing a goal',
  celebrate: 'success, a win, excitement',
  facepalm: 'a mistake, "galti", something silly',
  explain: 'teaching, explaining a step',
  laptop: 'working, coding, using an app or AI tool',
  wave: 'hello, intro, goodbye',
  sad: 'a problem, loss, disappointment',
  shocked: 'a surprise, an unbelievable fact',
  idea: 'an idea, a trick, the "aha" moment',
};

/** What each drawn object means. */
export const PROP_MEANING: Record<Prop, string> = {
  phone: 'mobile, apps, social media, reels',
  coins: 'money, price, earning, saving',
  rocket: 'growth, launch, going viral, fast',
  chartUp: 'increase, profit, more views',
  chartDown: 'decrease, loss, falling numbers',
  clock: 'time, minutes, deadline, waiting',
  bulb: 'idea, tip, smart trick',
  heart: 'love, likes, health',
  lock: 'security, privacy, password, locked',
  moneyBag: 'big money, salary, savings, rich',
  trophy: 'winning, best, number one, achievement',
  warning: 'danger, mistake to avoid, careful',
  gift: 'free, bonus, surprise',
  camera: 'photo, video, shooting, content',
  laptop: 'computer, work, online, software',
  book: 'learning, study, reading, course',
  fire: 'trending, hot, viral, intense',
  star: 'best, rating, special, important',
  check: 'yes, correct, done, do this',
  cross: 'no, wrong, avoid, do not',
  calendar: 'days, dates, schedule, every day',
  chat: 'talking, comments, messages, conversation',
  search: 'search, finding, research, Google',
  target: 'goal, aim, focus, exact result',
};

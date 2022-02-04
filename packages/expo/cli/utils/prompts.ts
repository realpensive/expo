import assert from 'assert';
import prompts, { Choice, Options, PromptObject, PromptType } from 'prompts';

import { CI } from './env';
import { AbortCommandError, CommandError } from './errors';

export type Question<V extends string = string> = PromptObject<V> & {
  optionsPerPage?: number;
};

export interface ExpoChoice<T> extends Choice {
  value: T;
}

export { PromptType };

type PromptOptions = { nonInteractiveHelp?: string } & Options;

export type NamelessQuestion = Omit<Question<'value'>, 'name' | 'type'>;

type InteractionOptions = { pause: boolean; canEscape?: boolean };

type InteractionCallback = (options: InteractionOptions) => void;

/** Interaction observers for detecting when keystroke tracking should pause/resume. */
const listeners: InteractionCallback[] = [];

export default async function prompt(
  questions: Question | Question[],
  { nonInteractiveHelp, ...options }: PromptOptions = {}
) {
  questions = Array.isArray(questions) ? questions : [questions];
  if (CI && questions.length !== 0) {
    let message = `Input is required, but 'npx expo' is in non-interactive mode.\n`;
    if (nonInteractiveHelp) {
      message += nonInteractiveHelp;
    } else {
      const question = questions[0];
      const questionMessage =
        typeof question.message === 'function'
          ? question.message(undefined, {}, question)
          : question.message;

      message += `Required input:\n${(questionMessage || '').trim().replace(/^/gm, '> ')}`;
    }
    throw new CommandError('NON_INTERACTIVE', message);
  }

  pauseInteractions();
  try {
    const results = await prompts(questions, {
      onCancel() {
        throw new AbortCommandError();
      },
      ...options,
    });

    return results;
  } finally {
    resumeInteractions();
  }
}

/**
 * Create a standard yes/no confirmation that can be cancelled.
 *
 * @param questions
 * @param options
 */
export async function confirmAsync(
  questions: NamelessQuestion,
  options?: PromptOptions
): Promise<boolean> {
  const { value } = await prompt(
    {
      initial: true,
      ...questions,
      name: 'value',
      type: 'confirm',
    },
    options
  );
  return value ?? null;
}

/** Select an option from a list of options. */
export async function selectAsync<T>(
  message: string,
  choices: ExpoChoice<T>[],
  options?: PromptOptions
): Promise<T> {
  const { value } = await prompt(
    {
      message,
      choices,
      name: 'value',
      type: 'select',
    },
    options
  );
  return value ?? null;
}

export const promptAsync = prompt;

/**
 * Used to pause/resume interaction observers while prompting (made for TerminalUI).
 *
 * @param callback
 */
export function addInteractionListener(callback: InteractionCallback) {
  listeners.push(callback);
}

export function removeInteractionListener(callback: InteractionCallback) {
  const listenerIndex = listeners.findIndex((_callback) => _callback === callback);
  assert(
    listenerIndex >= 0,
    'removeInteractionListener(): cannot remove an unregistered event listener.'
  );
  listeners.splice(listenerIndex, 1);
}

/** Notify all listeners that keypress observations must pause. */
export function pauseInteractions(options: Omit<InteractionOptions, 'pause'> = {}) {
  for (const listener of listeners) {
    listener({ pause: true, ...options });
  }
}

/** Notify all listeners that keypress observations can start.. */
export function resumeInteractions(options: Omit<InteractionOptions, 'pause'> = {}) {
  for (const listener of listeners) {
    listener({ pause: false, ...options });
  }
}

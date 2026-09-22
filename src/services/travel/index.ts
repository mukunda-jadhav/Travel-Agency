import { config } from "../../config.js";
import { advance } from "./conversation.js";
import { extractIntent } from "./intent.js";
import { providers } from "./providers.js";
import {
  FileTravelStore,
  SupabaseTravelStore,
  type TravelStore,
} from "./store.js";
import { handleBookingCommand } from "./commands.js";
import { newSession } from "./types.js";

export function createTravelAssistant(
  store: TravelStore,
  dependencies = { extractIntent, providers },
  clock = () => new Date(),
) {
  // Serialize commits across users too: the local demo uses one atomic JSON file.
  let queue: Promise<unknown> = Promise.resolve();
  return (userId: string, input: string, eventId: string): Promise<string> => {
    const result = queue
      .catch(() => undefined)
      .then(async () => {
        if (
          !/^[\w:+.-]{3,100}$/.test(userId) ||
          !eventId ||
          eventId.length > 250 ||
          !input.trim() ||
          input.length > 4000
        )
          throw new Error("Invalid travel message");
        const cached = await store.reply(userId, eventId);
        if (cached !== undefined) return cached;
        const now = clock();
        let session = await store.load(userId);
        let expired = false;
        if (
          session &&
          now.getTime() - Date.parse(session.lastUpdatedAt) >
            config.TRAVEL_SESSION_HOURS * 3600000
        ) {
          session = undefined;
          expired = true;
        }
        session ??= newSession(userId, now);
        const command = await handleBookingCommand(store, session, input, now);
        if (command) {
          await store.commit(userId, eventId, command);
          return command.reply;
        }
        const extraction = await dependencies.extractIntent(input, session);
        const turn = await advance(
          session,
          input,
          extraction,
          dependencies.providers,
          now,
          config.TRAVEL_TIMEZONE,
        );
        if (expired) turn.reply = "Your previous search expired. " + turn.reply;
        await store.commit(userId, eventId, turn);
        return turn.reply;
      });
    queue = result;
    return result;
  };
}
export const runTravelAssistant = createTravelAssistant(
  config.DEMO_MODE
    ? new FileTravelStore(config.TRAVEL_DATA_FILE)
    : new SupabaseTravelStore(),
);

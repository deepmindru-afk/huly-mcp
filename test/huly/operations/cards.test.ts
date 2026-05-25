import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"

import { CardIdentifier, CardSpaceIdentifier } from "../../../src/domain/schemas/shared.js"
import { HulyClient } from "../../../src/huly/client.js"
import { updateCard } from "../../../src/huly/operations/cards.js"

describe("updateCard", () => {
  it.effect("fails when no update fields are provided", () =>
    Effect.gen(function*() {
      const err = yield* Effect.flip(
        updateCard({
          cardSpace: CardSpaceIdentifier.make("Cards"),
          card: CardIdentifier.make("Roadmap")
        }).pipe(Effect.provide(HulyClient.testLayer({})))
      )

      expect(err._tag).toBe("NoUpdateFieldsError")
    }))
})

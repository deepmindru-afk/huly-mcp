import type { Organization as HulyOrganization } from "@hcengineering/contact"
import { Effect } from "effect"

import { Count } from "../../domain/schemas/shared.js"
import type { HulyClient, HulyClientError } from "../client.js"
import { OrganizationIdentifierAmbiguousError, OrganizationNotFoundError } from "../errors.js"
import { contact } from "../huly-plugins.js"
import { hulyQuery } from "./query-helpers.js"
import { toRef } from "./sdk-boundary.js"

export const findOrganizationByIdentifier = (
  client: HulyClient["Type"],
  identifier: string
): Effect.Effect<
  HulyOrganization | undefined,
  HulyClientError | OrganizationIdentifierAmbiguousError
> =>
  Effect.gen(function*() {
    const byId = yield* client.findOne<HulyOrganization>(
      contact.class.Organization,
      hulyQuery<HulyOrganization>({ _id: toRef<HulyOrganization>(identifier) })
    )
    if (byId !== undefined) return byId

    const byName = yield* client.findAll<HulyOrganization>(
      contact.class.Organization,
      hulyQuery<HulyOrganization>({ name: identifier })
    )

    if (byName.length === 0) return undefined
    if (byName.length > 1) {
      return yield* new OrganizationIdentifierAmbiguousError({
        identifier,
        matches: Count.make(byName.length)
      })
    }
    return byName[0]
  })

export const resolveOrganizationByIdentifier = (
  client: HulyClient["Type"],
  identifier: string
): Effect.Effect<
  HulyOrganization,
  HulyClientError | OrganizationIdentifierAmbiguousError | OrganizationNotFoundError
> =>
  Effect.gen(function*() {
    const organization = yield* findOrganizationByIdentifier(client, identifier)
    if (organization === undefined) {
      return yield* new OrganizationNotFoundError({ identifier })
    }
    return organization
  })

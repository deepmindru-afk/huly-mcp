import { describe } from "@effect/vitest"
import * as fc from "fast-check"
import { expect, it } from "vitest"

import { sanitizeHulyRuntimeConfigFromEnv, sanitizeHulyRuntimeConfigFromHeaders } from "../../src/config/config.js"
import { DEFAULT_HULY_CONNECTION_TIMEOUT } from "../../src/config/huly-config-constants.js"
import { parseToolsets } from "../../src/mcp/huly-context-tool.js"
import { CATEGORY_NAMES } from "../../src/mcp/tools/index.js"
import { propertyTestParameters } from "../helpers/property.js"

const secretArbitrary = fc.uuid().map((value) => `secret-${value}`)
const hostnameArbitrary = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
  fc.constantFrom("example.com", "huly.app", "internal.test")
).map(([subdomain, domain]) => `${subdomain}.${domain}`)
const protocolArbitrary = fc.constantFrom("http", "https")
const validTimeoutStringArbitrary = fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }).map(String)
const invalidNumericTimeoutStringArbitrary = fc.oneof(
  fc.constantFrom(
    "0",
    "-1",
    "-30000",
    "1.1",
    "30000.5",
    " 1",
    "1 ",
    "\t30000",
    "30000\n",
    String(Number.MAX_SAFE_INTEGER + 1),
    "999999999999999999999999999999"
  ),
  fc.integer({ min: Number.MIN_SAFE_INTEGER, max: -1 }).map(String),
  fc.integer({ min: 1, max: 100_000 }).map((value) => `${value}.5`)
)
const secretInvalidTimeoutStringArbitrary = fc.uuid().map((value) => `invalid-timeout-secret-${value}`)
const invalidTimeoutStringArbitrary = fc.oneof(
  invalidNumericTimeoutStringArbitrary.map((timeout) => ({ leakSecrets: [], timeout })),
  secretInvalidTimeoutStringArbitrary.map((timeout) => ({ leakSecrets: [timeout], timeout }))
)

const serialized = (value: unknown): string => JSON.stringify(value)

const expectNoLeak = (value: unknown, secrets: ReadonlyArray<string>): void => {
  const output = serialized(value)
  for (const secret of secrets) {
    expect(output).not.toContain(secret)
  }
}

describe("sanitized runtime context properties", () => {
  it("never serializes env token, email, password, or unsafe URL components", () => {
    fc.assert(
      fc.property(
        hostnameArbitrary,
        protocolArbitrary,
        secretArbitrary,
        secretArbitrary,
        secretArbitrary,
        secretArbitrary,
        secretArbitrary,
        (host, protocol, user, password, token, querySecret, pathSecret) => {
          const context = sanitizeHulyRuntimeConfigFromEnv({
            HULY_URL: `${protocol}://${user}:${password}@${host}/${pathSecret}?token=${querySecret}#${querySecret}`,
            HULY_TOKEN: token,
            HULY_EMAIL: `${user}@${host}`,
            HULY_PASSWORD: password,
            HULY_WORKSPACE: "workspace"
          })

          expectNoLeak(context, [user, password, token, querySecret, pathSecret])
          expect(context.huly.url).toEqual({
            configured: true,
            valid: true,
            origin: `${protocol}://${host}`,
            host,
            protocol: `${protocol}:`
          })
          expect(Object.keys(context.huly.url).sort()).toEqual(["configured", "host", "origin", "protocol", "valid"])
        }
      ),
      propertyTestParameters
    )
  })

  it("never serializes header token or unsafe URL components", () => {
    fc.assert(
      fc.property(
        hostnameArbitrary,
        protocolArbitrary,
        secretArbitrary,
        secretArbitrary,
        secretArbitrary,
        secretArbitrary,
        (host, protocol, user, password, token, querySecret) => {
          const context = sanitizeHulyRuntimeConfigFromHeaders({
            "x-huly-url": `${protocol}://${user}:${password}@${host}/path?token=${querySecret}#${querySecret}`,
            "x-huly-workspace": "workspace",
            "x-huly-token": token
          }, {
            HULY_TOKEN: `env-${token}`
          })

          expectNoLeak(context, [user, password, token, `env-${token}`, querySecret])
          expect(context.huly.url).toEqual({
            configured: true,
            valid: true,
            origin: `${protocol}://${host}`,
            host,
            protocol: `${protocol}:`
          })
          expect(Object.keys(context.huly.url).sort()).toEqual(["configured", "host", "origin", "protocol", "valid"])
        }
      ),
      propertyTestParameters
    )
  })

  it("reports valid generated timeout strings with their source and parsed value", () => {
    fc.assert(
      fc.property(validTimeoutStringArbitrary, (timeout) => {
        const envContext = sanitizeHulyRuntimeConfigFromEnv({ HULY_CONNECTION_TIMEOUT: timeout })
        const headerContext = sanitizeHulyRuntimeConfigFromHeaders({ "x-huly-connection-timeout": timeout })

        expect(envContext.huly.connectionTimeout).toEqual({
          configured: true,
          valid: true,
          valueMs: Number(timeout),
          defaultMs: DEFAULT_HULY_CONNECTION_TIMEOUT,
          source: "env"
        })
        expect(headerContext.huly.connectionTimeout).toEqual({
          configured: true,
          valid: true,
          valueMs: Number(timeout),
          defaultMs: DEFAULT_HULY_CONNECTION_TIMEOUT,
          source: "header"
        })
      }),
      propertyTestParameters
    )
  })

  it("reports invalid generated timeout strings as invalid without leaking the raw value", () => {
    fc.assert(
      fc.property(invalidTimeoutStringArbitrary, ({ leakSecrets, timeout }) => {
        const envContext = sanitizeHulyRuntimeConfigFromEnv({ HULY_CONNECTION_TIMEOUT: timeout })
        const headerContext = sanitizeHulyRuntimeConfigFromHeaders({ "x-huly-connection-timeout": timeout })

        expect(envContext.huly.connectionTimeout).toEqual({
          configured: true,
          valid: false,
          defaultMs: DEFAULT_HULY_CONNECTION_TIMEOUT,
          source: "invalid"
        })
        expect(headerContext.huly.connectionTimeout).toEqual({
          configured: true,
          valid: false,
          defaultMs: DEFAULT_HULY_CONNECTION_TIMEOUT,
          source: "invalid"
        })
        expectNoLeak(envContext, leakSecrets)
        expectNoLeak(headerContext, leakSecrets)
      }),
      propertyTestParameters
    )
  })
})

describe("parseToolsets properties", () => {
  it("normalizes known categories and reports unknown categories", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...CATEGORY_NAMES), { maxLength: 8 }),
        fc.array(fc.stringMatching(/^[a-z][a-z0-9_-]{1,20}$/).filter((name) => !CATEGORY_NAMES.has(name)), {
          maxLength: 8
        }),
        (knownCategories, unknownCategories) => {
          const requested = [...knownCategories, ...unknownCategories]
          const raw = requested.map((category, index) => index % 2 === 0 ? category.toUpperCase() : ` ${category} `)
            .join(",")
          const warnings: Array<string> = []
          const result = parseToolsets(raw, (message) => {
            warnings.push(message)
          })

          expect(result.requestedCategories).toEqual(requested.map((category) => category.toLowerCase()))
          expect(result.ignoredCategories).toEqual(unknownCategories)
          expect(warnings).toHaveLength(unknownCategories.length)

          if (knownCategories.length === 0) {
            expect(result.enabledCategories).toBeUndefined()
          } else {
            expect(result.enabledCategories).toEqual(new Set(knownCategories))
          }
        }
      ),
      propertyTestParameters
    )
  })
})

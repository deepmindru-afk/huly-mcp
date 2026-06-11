import type { ContactChannelProvider } from "../../domain/schemas/contact-channels.js"
import { ContactChannelProviderValues } from "../../domain/schemas/contact-channels.js"
import { InvalidContactProviderError } from "../errors.js"
import { contact } from "../huly-plugins.js"

const CHANNEL_PROVIDER_REFS_BY_SDK_KEY = {
  Email: contact.channelProvider.Email,
  Phone: contact.channelProvider.Phone,
  LinkedIn: contact.channelProvider.LinkedIn,
  Twitter: contact.channelProvider.Twitter,
  Telegram: contact.channelProvider.Telegram,
  GitHub: contact.channelProvider.GitHub,
  Facebook: contact.channelProvider.Facebook,
  Homepage: contact.channelProvider.Homepage,
  Whatsapp: contact.channelProvider.Whatsapp,
  Skype: contact.channelProvider.Skype,
  Profile: contact.channelProvider.Profile,
  Viber: contact.channelProvider.Viber
} satisfies Record<
  keyof typeof contact.channelProvider,
  typeof contact.channelProvider[keyof typeof contact.channelProvider]
>

export const CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY = {
  Email: "email",
  Phone: "phone",
  LinkedIn: "linkedin",
  Twitter: "twitter",
  Telegram: "telegram",
  GitHub: "github",
  Facebook: "facebook",
  Homepage: "homepage",
  Whatsapp: "whatsapp",
  Skype: "skype",
  Profile: "profile",
  Viber: "viber"
} satisfies Record<keyof typeof contact.channelProvider, ContactChannelProvider>

const CHANNEL_PROVIDERS = {
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.Email]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.Email,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.Phone]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.Phone,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.LinkedIn]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.LinkedIn,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.Twitter]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.Twitter,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.Telegram]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.Telegram,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.GitHub]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.GitHub,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.Facebook]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.Facebook,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.Homepage]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.Homepage,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.Whatsapp]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.Whatsapp,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.Skype]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.Skype,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.Profile]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.Profile,
  [CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY.Viber]: CHANNEL_PROVIDER_REFS_BY_SDK_KEY.Viber
} satisfies Record<ContactChannelProvider, typeof contact.channelProvider[keyof typeof contact.channelProvider]>

type MappedChannelProvider =
  typeof CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY[keyof typeof CONTACT_CHANNEL_PROVIDER_BY_SDK_KEY]
type ExactChannelProviderMapping = [ContactChannelProvider] extends [MappedChannelProvider]
  ? [MappedChannelProvider] extends [ContactChannelProvider] ? true : never
  : never

const exactChannelProviderMapping = <T extends true>(value: T): T => value
exactChannelProviderMapping<ExactChannelProviderMapping>(true)

export const listContactChannelProviderLabels = (): ReadonlyArray<ContactChannelProvider> =>
  ContactChannelProviderValues

export const toContactChannelProviderRef = (
  provider: ContactChannelProvider
): typeof CHANNEL_PROVIDERS[typeof provider] => CHANNEL_PROVIDERS[provider]

export const fromContactChannelProviderRef = (
  providerRef: string
): ContactChannelProvider | InvalidContactProviderError => {
  switch (providerRef) {
    case CHANNEL_PROVIDERS.email:
      return "email"
    case CHANNEL_PROVIDERS.phone:
      return "phone"
    case CHANNEL_PROVIDERS.linkedin:
      return "linkedin"
    case CHANNEL_PROVIDERS.twitter:
      return "twitter"
    case CHANNEL_PROVIDERS.github:
      return "github"
    case CHANNEL_PROVIDERS.facebook:
      return "facebook"
    case CHANNEL_PROVIDERS.telegram:
      return "telegram"
    case CHANNEL_PROVIDERS.homepage:
      return "homepage"
    case CHANNEL_PROVIDERS.whatsapp:
      return "whatsapp"
    case CHANNEL_PROVIDERS.skype:
      return "skype"
    case CHANNEL_PROVIDERS.profile:
      return "profile"
    case CHANNEL_PROVIDERS.viber:
      return "viber"
    default:
      return new InvalidContactProviderError({ provider: providerRef })
  }
}

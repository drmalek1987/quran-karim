# Google Play Data safety answers (from 4.9, voice donation v2)

Fill these in Play Console › App content › Data safety. They match `store/privacy-policy.html` (2 November 2026).
If the dataset is ever made public, or another kind of data is added, update both.

## Data collection and security
- Does your app collect or share any of the required user data types? **Yes** (only through the optional voice donation).
- Is all of the user data collected by your app encrypted in transit? **Yes** (HTTPS to the relay).
- Do you provide a way for users to request that their data is deleted? **Yes**: in-app «امسح كل تسجيلاتي» / "Delete all my recordings",
  and by email (the contact address in the policy).

## Data types
| Category › type | Collected | Shared | Optional? | Ephemeral? | Purposes |
|---|---|---|---|---|---|
| Audio › Voice or sound recordings | Yes | No | Optional (off by default, explicit consent) | No | App functionality (improving the recitation recogniser) |
| App activity › Other user-generated content (the verse text and word numbers of each clip) | Yes | No | Optional | No | App functionality |
| Device or other IDs (random per-install id made by the app, not the Android ID; the relay stores only its hash) | Yes | No | Optional | No | App functionality (deleting a device's clips, rate limits) |

Not collected: location (stays on the device), personal info, contacts, financial info, health, messages, photos, files,
calendar, web history, app interactions, crash logs, diagnostics.

"Shared" is **No**: Hugging Face only stores the data for the developer (a service provider), which Play does not count as sharing.

## Notes for review
- Uploads go to `https://drabdelraman-quran-voice-relay.hf.space` (the developer's relay), stored in the private dataset
  `DrAbdelraman/quran-voice-donations`.
- The microphone is only used in the memorisation test; see `store/PLAY-REVIEW.md`.

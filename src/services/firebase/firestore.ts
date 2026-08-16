/**
 * Firestore, through the seam. See ./README.md.
 *
 * A plain re-export today: iOS and Android run exactly the code they always
 * did. The value is that 32 files now name *this* module rather than
 * `@react-native-firebase/firestore`, so a HarmonyOS build can supply
 * `firestore.harmony.ts` forwarding to `firebase/firestore` — whose modular
 * API has the same signatures — without any of them changing again.
 */
export * from '@react-native-firebase/firestore';

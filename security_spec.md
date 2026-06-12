# Security Specification & Threat Model (TDD Spec)

## 1. Data Invariants
- **Identity Lock**: A custom dance project document must have a `userId` field matching the `uid` of the authenticated user.
- **Strict Size/Type Bounds**: Fields like `name` and `speechText` must have a reasonable length limit (e.g., name string <= 128 characters, speechText string <= 256 characters) to avoid "Denial of Wallet" and database pollution.
- **Unauthenticated Read/Write Block**: All operations on `/projects/{projectId}` require active Firebase authentication.
- **Immutability of Owner**: Once a project is created, the `userId` field cannot be altered.
- **Immutability of Creation Timestamp**: The `createdAt` field cannot be altered on update.

---

## 2. The "Dirty Dozen" Vulnerability Payloads
The following payloads constitute invalid state transactions, identity spoofing, value poisoning, or resource exhaustions that our Firestore security rules must block:

1. **Payload 1: Unauthenticated Create Attempt** - Trying to create a project document without active authentication.
2. **Payload 2: Identity Spoofing (Foreign Owner)** - Trying to create a project document where `userId` is set to another user's UID (e.g., `"attacker_uid"` writing `"victim_uid"`).
3. **Payload 3: Read Attempt on Private Projects** - Attacker trying to list/get another user's private project.
4. **Payload 4: Delete Another User's Project** - Authenticated hacker trying to delete a project document owned by another user.
5. **Payload 5: Massive String Value Poisoning in Name** - Writing a project with a 2MB string as the `name` field.
6. **Payload 6: Massive String Value Poisoning in SpeechText** - Writing a project with a 1MB string in `speechText`.
7. **Payload 7: Illegal State Transition on Immutable Owner** - Updating an existing project document to switch the `userId` field to a different value.
8. **Payload 8: Immutable CreatedAt Override** - Attempting to rewrite the `createdAt` timestamp of a project on update.
9. **Payload 9: Injection of Arbitrary Ghost Fields** - Attempting to write a project with an unauthorized property `adminAccessGranted: true`.
10. **Payload 10: Out of Bound Tempo Value Poisoning** - Attempting to write `danceSpeed` as a non-number (e.g., `"fast"`) or an extreme value (e.g. `999.0`).
11. **Payload 11: Invalid Enum Choreography Move** - Setting `danceMoveType` to a forbidden/non-enum value (e.g. `"backflip_extreme"`).
12. **Payload 12: Insecure List Query (Client Bypass)** - Attempting a list query on all projects without specifying a personal user collection query constraint.

---

## 3. Test Runner Definition (`firestore.rules.test.ts`)
The test cases listed below specify that each of the "Dirty Dozen" scenarios returns `PERMISSION_DENIED` under our Security Rules.

```ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

describe("Stickman Dance Studio - Security Rule Verification", () => {
  let testEnv;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "ltsdc-eb8b1",
      firestore: {
        rules: require('fs').readFileSync('firestore.rules', 'utf8')
      }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it("Payload 1: Should block unauthenticated write", async () => {
    const context = testEnv.unauthenticatedContext();
    const db = context.firestore();
    await assertFails(setDoc(doc(db, "projects/proj_001"), {
      id: "proj_001",
      name: "My Unauth Dance",
      id: "unauth_user"
    }));
  });

  it("Payload 2: Should block fake identity creation (userId mismatch)", async () => {
    const context = testEnv.authenticatedContext("hacker_uid");
    const db = context.firestore();
    await assertFails(setDoc(doc(db, "projects/proj_001"), {
      id: "proj_001",
      name: "Spoof Dance",
      createdAt: "2026-06-12",
      danceSpeed: 1.0,
      danceMoveType: "all",
      userId: "victim_uid"
    }));
  });
});
```

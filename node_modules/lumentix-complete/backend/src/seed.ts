import "./config/firebase";
import { firebaseAuth } from "./config/firebase";
import { upsertUser } from "./services/firestore.service";
import type { UserRole } from "./types/models";

async function upsertFirebaseAuthUser(input: { email: string; password: string; name: string }) {
  try {
    const existing = await firebaseAuth.getUserByEmail(input.email);
    await firebaseAuth.updateUser(existing.uid, {
      displayName: input.name,
      password: input.password,
      emailVerified: true,
      disabled: false
    });
    return existing.uid;
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") {
      throw error;
    }

    const created = await firebaseAuth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
      emailVerified: true,
      disabled: false
    });
    return created.uid;
  }
}

async function main() {
  const users: Array<{ email: string; password: string; role: UserRole; name: string }> = [
    {
      email: "admin@lumentix.in",
      password: "Admin@12345",
      role: "Admin",
      name: "LUMENTIX Admin"
    },
    {
      email: "hr@lumentix.in",
      password: "Hr@12345",
      role: "HR",
      name: "LUMENTIX HR"
    }
  ];

  for (const user of users) {
    let uid: string | undefined;

    try {
      uid = await upsertFirebaseAuthUser(user);
    } catch (error) {
      console.warn(`Firebase Auth user could not be prepared for ${user.email}. Configure Firebase Admin or Auth emulator and rerun seed.`);
      console.warn(error);
    }

    await upsertUser({
      id: uid,
      email: user.email,
      role: user.role,
      name: user.name
    });
  }

  console.log("Seed complete: admin@lumentix.in / Admin@12345, hr@lumentix.in / Hr@12345");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// Creates the first ADMIN account. Reads credentials from the environment
// so no password is stored in the repo:
//   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run seed:admin
import dataSource from '../data-source.js';
import { User } from '../../modules/users/entities/user.entity.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { hashPassword } from '../../common/utils/password.util.js';

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password || password.length < 8) {
    throw new Error(
      'Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 8 chars)',
    );
  }

  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository(User);

    if (await repo.findOne({ where: { email } })) {
      console.log(`User ${email} already exists, nothing to do.`);
      return;
    }

    await repo.save(
      repo.create({
        fullName: process.env.SEED_ADMIN_NAME ?? 'System Admin',
        email,
        passwordHash: await hashPassword(password),
        role: UserRole.ADMIN,
        isActive: true,
      }),
    );

    console.log(`Admin ${email} created.`);
  } finally {
    await dataSource.destroy();
  }
}

seedAdmin().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

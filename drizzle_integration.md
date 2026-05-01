1. Install ORM
Add the ORM to your project.
Code:
File: Code
```
npm install drizzle-orm
```

File: Code
```
npm install drizzle-kit --save-dev
```

2. Configure ORM
Set up your ORM configuration.
Code:
File: .env
```
DATABASE_URL="postgresql://postgres.ffuyspzkuaiymxbcwspq:[YOUR-PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
```

File: drizzle/schema.ts
```
1import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
2
3export const users = pgTable('users', {
4  id: serial('id').primaryKey(),
5  fullName: text('full_name'),
6  phone: varchar('phone', { length: 256 }),
7});
```

File: index.tsx
```
1import { drizzle } from 'drizzle-orm/postgres-js'
2import postgres from 'postgres'
3import { users } from './drizzle/schema'
4
5const connectionString = process.env.DATABASE_URL
6
7// Disable prefetch as it is not supported for "Transaction" pool mode
8const client = postgres(connectionString, { prepare: false })
9const db = drizzle(client);
10
11const allUsers = await db.select().from(users);
```

3. Install Agent Skills (Optional)
Agent Skills give AI coding tools ready-made instructions, scripts, and resources for working with Supabase more accurately and efficiently.
Details:
npx skills add supabase/agent-skills
Code:
File: Code
```
npx skills add supabase/agent-skills
```
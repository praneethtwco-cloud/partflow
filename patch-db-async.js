import fs from 'fs';

const files = ['services/db.ts', 'services/db-supabase.ts'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    /login\(username: string, password\?: string\): User \| null \{/g,
    "async login(username: string, password?: string): Promise<User | null> {"
  );

  content = content.replace(
    /if \(password && \(!found\.password \|\| !bcrypt\.compareSync\(password, found\.password\)\)\) return null;/g,
    "if (password && (!found.password || !(await bcrypt.compare(password, found.password)))) return null;"
  );

  content = content.replace(
    /if \(!user\.password \|\| !bcrypt\.compareSync\(oldPassword, user\.password\)\) \{/g,
    "if (!user.password || !(await bcrypt.compare(oldPassword, user.password))) {"
  );

  content = content.replace(
    /user\.password = bcrypt\.hashSync\(newPassword, 10\);/g,
    "user.password = await bcrypt.hash(newPassword, 10);"
  );

  content = content.replace(
    /if \(idx >= 0\) this\.cache\.users\[idx\]\.password = bcrypt\.hashSync\(newPassword, 10\);/g,
    "if (idx >= 0) this.cache.users[idx].password = await bcrypt.hash(newPassword, 10);"
  );

  fs.writeFileSync(file, content);
  console.log("Patched", file);
}

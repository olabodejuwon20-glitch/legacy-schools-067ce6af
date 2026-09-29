import { createClient } from "@supabase/supabase-js";
const url = "https://vcescjtrhgwvbappmwcp.supabase.co";
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TEACHERS = [
  ["Mrs. Adaeze Okafor", "adaeze.okafor@demo.school", "Mathematics"],
  ["Mr. Bayo Adeyemi",   "bayo.adeyemi@demo.school",  "English Language"],
  ["Mrs. Halima Yusuf",  "halima.yusuf@demo.school",  "Biology"],
];
const STUDENTS = [
  "Chidera Eze","Tunde Ogunleye","Aisha Bello","Emeka Nwosu","Fatima Sani","Kelechi Obi",
  "Ngozi Umeh","Sani Garba","Adaobi Mba","Ifeanyi Okoro","Zainab Mohammed","David Adewale"
].map((n,i) => [n, n.toLowerCase().replace(/\s+/g,".")+"@demo.school"]);
const PARENTS = [
  ["Mr. Chuka Eze","chuka.eze@demo.parent"],
  ["Mrs. Bola Ogunleye","bola.ogunleye@demo.parent"],
  ["Mr. Ibrahim Bello","ibrahim.bello@demo.parent"],
  ["Mrs. Patricia Nwosu","patricia.nwosu@demo.parent"],
];

async function mkUser(email, full_name) {
  // Try create; if exists, look up
  const { data, error } = await sb.auth.admin.createUser({
    email, password: "Demo@1234", email_confirm: true, user_metadata: { full_name }
  });
  if (error) {
    if (/already|exists|registered/i.test(error.message)) {
      const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
      const u = list.users.find(x => x.email === email);
      if (u) return u.id;
    }
    throw error;
  }
  return data.user.id;
}

const out = { teachers: [], students: [], parents: [] };
for (const [name, email, subj] of TEACHERS) {
  const id = await mkUser(email, name);
  out.teachers.push({ id, name, email, subj });
}
for (const [name, email] of STUDENTS) {
  const id = await mkUser(email, name);
  out.students.push({ id, name, email });
}
for (const [name, email] of PARENTS) {
  const id = await mkUser(email, name);
  out.parents.push({ id, name, email });
}
console.log(JSON.stringify(out, null, 2));
import { writeFileSync } from "fs";
writeFileSync("/tmp/seed-ids.json", JSON.stringify(out));

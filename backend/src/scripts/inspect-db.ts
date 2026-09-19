import 'dotenv/config';
import mongoose from 'mongoose';
import Department from '../shared/models/Department.js';
import Integration from '../shared/models/Integration.js';
import User from '../shared/models/User.js';

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('--- Departments ---');
  console.log(JSON.stringify(await Department.find().select('-__v'), null, 2));
  console.log('--- Integrations ---');
  console.log(JSON.stringify(await Integration.find().select('-__v').populate('departmentId', 'name code'), null, 2));
  console.log('--- Users (no password) ---');
  const users = await User.find().select('-password -__v');
  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
}

inspect().catch(e => { console.error(e); process.exit(1); });